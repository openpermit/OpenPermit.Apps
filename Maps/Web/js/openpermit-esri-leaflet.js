/*! OpenPermit Esri Leaflet Extensions - v0.1.0
*   Copyright (c) 2015 OpenPermit Foundation, Inc.
*   MIT License*/
(function (factory) {
    // define an AMD module that relies on 'leaflet'
    if (typeof define === 'function' && define.amd) {
        define(['leaflet', 'esri-leaflet'], function (L, Esri) {
            return factory(L, Esri);
        });

        // define a common js module that relies on 'leaflet'
    } else if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory(require('leaflet'), require('esri-leaflet'));
    }

    // define globals if we can find the proper place to attach them to.
    if (window && window.L && window.L.esri) {
        window.L.esri.op = factory(L, L.esri);

    }
}(function (L, Esri) {

    function boundsToOpenSearch(bounds) {
        bounds = L.latLngBounds(bounds);
        return bounds.getSouthWest().lng + ',' + bounds.getSouthWest().lat + ',' + bounds.getNorthEast().lng + ',' + bounds.getNorthEast().lat;
    }

    function serialize(params) {
        var data = '';

        for (var key in params) {
            if (params.hasOwnProperty(key)) {
                var param = params[key];
                var type = Object.prototype.toString.call(param);
                var value;

                if (data.length) {
                    data += '&';
                }

                if (type === '[object Array]') {
                    value = (Object.prototype.toString.call(param[0]) === '[object Object]') ? JSON.stringify(param) : param.join(',');
                } else if (type === '[object Object]') {
                    value = JSON.stringify(param);
                } else if (type === '[object Date]') {
                    value = param.valueOf();
                } else {
                    value = param;
                }

                data += encodeURIComponent(key) + '=' + encodeURIComponent(value);
            }
        }

        return data;
    }

    function createRequest(callback, context) {
        var httpRequest = new XMLHttpRequest();

        httpRequest.onerror = function (e) {
            httpRequest.onreadystatechange = L.Util.falseFn;

            callback.call(context, {
                error: {
                    code: 500,
                    message: 'XMLHttpRequest error'
                }
            }, null);
        };

        httpRequest.onreadystatechange = function () {
            var response;
            var error;

            if (httpRequest.readyState === 4) {
                try {
                    response = JSON.parse(httpRequest.responseText);
                } catch (e) {
                    response = null;
                    error = {
                        code: 500,
                        message: 'Could not parse response as JSON. This could also be caused by a CORS or XMLHttpRequest error.'
                    };
                }

                if (!error && response.error) {
                    error = response.error;
                    response = null;
                }

                httpRequest.onerror = L.Util.falseFn;

                callback.call(context, error, response);
            }
        };

        return httpRequest;
    }

    function request(url, params, callback, context){
        var paramString = serialize(params);
        var httpRequest = createRequest(callback, context);
        var requestLength = (url + '?' + paramString).length;

        // request is less then 2000 characters and the browser supports CORS, make GET request with XMLHttpRequest
        if(requestLength <= 2000 && L.esri.Support.CORS){
            httpRequest.open('GET', url + '?' + paramString);
            httpRequest.setRequestHeader('Accept', 'application/vnd.geo+json');
            httpRequest.send(null);

            // request is less more then 2000 characters and the browser supports CORS, make POST request with XMLHttpRequest
        } else if (requestLength > 2000 && L.esri.Support.CORS){
            httpRequest.open('POST', url);
            httpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            httpRequest.send(paramString);

            // request is less more then 2000 characters and the browser does not support CORS, make a JSONP request
        } else if(requestLength <= 2000 && !L.esri.Support.CORS){
            return L.esri.Request.get.JSONP(url, params, callback, context);

            // request is longer then 2000 characters and the browser does not support CORS, log a warning
        } else {
            Esri.Util.warn('a request to ' + url + ' was longer then 2000 characters and this browser cannot make a cross-domain post request. Please use a proxy http://esri.github.io/esri-leaflet/api-reference/request.html');
            return;
        }

        return httpRequest;
    }

    var OpenPermit = {};
    OpenPermit.Services = {};

    OpenPermit.Services.ReadOnlyFeatureService = Esri.Services.Service.extend({

        //identify: function () {
        //    return new EsriLeaflet.Tasks.identifyFeatures(this);
        //},

        //find: function () {
        //    return new EsriLeaflet.Tasks.Find(this);
        //},

        _request: function (method, path, params, callback, context) {
            this.fire('requeststart', {
                url: this.options.url + path,
                params: params,
                method: method
            });

            var wrappedCallback = this._createServiceCallback(method, path, params, callback, context);
            var url = (this.options.proxy) ? this.options.proxy + '?' + this.options.url + path : this.options.url + path;
            return request(url, params, wrappedCallback);
        },

        query: function () {
            return new OpenPermit.Tasks.Query(this);
        }
    }); 

    OpenPermit.Tasks = {};

    OpenPermit.Tasks.Query = Esri.Tasks.Query.extend({
        path: 'op/permits',

        params: {
            
        },

        intersects: function (geometry) {
            this._setGeometry(geometry);
            return this;
        },

        between: function (start, end) {
            this.params.time = [start.valueOf(), end.valueOf()];
            return this;
        },

        _setGeometry: function (geometry) {
            
            // convert bounds to extent and finish
            if (geometry instanceof L.LatLngBounds) {
                // set geometry + geometryType
                this.params.bbox = boundsToOpenSearch(geometry);
                return;
            }

            // convert L.Marker > L.LatLng
            if (geometry.getLatLng) {
                geometry = geometry.getLatLng();
            }

            // convert L.LatLng to a geojson point and continue;
            if (geometry instanceof L.LatLng) {
                geometry = {
                    type: 'Point',
                    coordinates: [geometry.lng, geometry.lat]
                };
            }

            // handle L.GeoJSON, pull out the first geometry
            if (geometry instanceof L.GeoJSON) {
                //reassign geometry to the GeoJSON value  (we are assuming that only one feature is present)
                geometry = geometry.getLayers()[0].feature.geometry;
                this.params.geometry = EsriLeaflet.Util.geojsonToArcGIS(geometry);
                this.params.geometryType = EsriLeaflet.Util.geojsonTypeToArcGIS(geometry.type);
            }

            // Handle L.Polyline and L.Polygon
            if (geometry.toGeoJSON) {
                geometry = geometry.toGeoJSON();
            }

            // handle GeoJSON feature by pulling out the geometry
            if (geometry.type === 'Feature') {
                // get the geometry of the geojson feature
                geometry = geometry.geometry;
            }

            // confirm that our GeoJSON is a point, line or polygon
            if (geometry.type === 'Point' || geometry.type === 'LineString' || geometry.type === 'Polygon') {
                this.params.geometry = EsriLeaflet.Util.geojsonToArcGIS(geometry);
                this.params.geometryType = EsriLeaflet.Util.geojsonTypeToArcGIS(geometry.type);
                return;
            }

            // warn the user if we havn't found a
            /* global console */
            Esri.Util.warn('invalid geometry passed to spatial query. Should be an L.LatLng, L.LatLngBounds or L.Marker or a GeoJSON Point Line or Polygon object');

            return;
        },

        run: function (callback, context) {
            this._cleanParams();

            return this.request(function (error, response) {
                this._trapSQLerrors(error);
                callback.call(context, error, response, response);
            }, this);
        }
    });

    OpenPermit.Tasks.query = function (params) {
        return new OpenPermit.Tasks.Query(params);
    };

    OpenPermit.Layers = {};
    
    OpenPermit.Layers.ClusteredOpenPermitLayer = Esri.Layers.ClusteredFeatureLayer.extend({
        initialize: function (options) {
            Esri.Layers.ClusteredFeatureLayer.prototype.initialize.call(this, options);

            this._service = new OpenPermit.Services.ReadOnlyFeatureService(options);
            // Leaflet 0.8 change to new propagation
            this._service.on('authenticationrequired requeststart requestend requesterror requestsuccess', function (e) {
                e = L.extend({
                    target: this
                }, e);
                this.fire(e.type, e);
            }, this);
        },
        _buildQuery: function (bounds) {
            var query = this._service.query()
                            .intersects(bounds);
            
            if (this.options.from && this.options.to) {
                query.between(this.options.from, this.options.to);
            }

            return query;
        }
    });

    OpenPermit.Layers.clusteredOpenPermitLayer = function (options) {
        return new OpenPermit.Layers.ClusteredOpenPermitLayer(options);
    };

    return OpenPermit;
}));
