/*  
 *   OpenPermit Map Sample - v0.3.0
 *   Copyright (c) 2015 OpenPermit Foundation, Inc.
 *   MIT License
 */
$(document).ready(function () {
    main();
});

var permitLayers = [];

function setStatusFilter(options, includeClosed) {
    
    options.statusList = ['Application Acceptance', 'In Review', 'Permit Issued', 'Inspection Phase'];
    if (includeClosed) {
        options.statusList.push('Permit Finaled');
        options.statusList.push('Permit Cancelled');
    }
}

function setDateFilters(options, timeFrame) {
        
    switch (timeFrame) {
        case '30d':
            options.from = Date.today().add({ days: -30 });
            break;
        case '60d':
            options.from = Date.today().add({ days: -60 });
            break;
        case '6m':
            options.from = Date.today().add({ months: -6 });
            break;
        case '1y':
            options.from = Date.today().add({ years: -1 });
            break;
        case '2y':
            options.from = Date.today().add({ years: -2 });
            break;
        default:
            break;
    }
}

function setupEsriPermitLayer(map, url, timeFrame, includeOpen, includeClosed) {

    // TODO setup filters for ESRI layer
    var esriPermits = L.esri.clusteredFeatureLayer({ url: url });
    esriPermits.bindPopup(function (feature) {
        return renderLeonPopup(feature);
    });
    esriPermits.addTo(map);
    return esriPermits;
}

function setupOpenPermitLayer(map, url, timeFrame, includeClosed, types) {

    var options = { url: url + '/' };
    if (types !== 'all') {
        options.typesList = [ types ];
    }
    setDateFilters(options, timeFrame);
    setStatusFilter(options, includeClosed);
    var permits = L.esri.op.Layers.clusteredOpenPermitLayer(options);
    permits.on('click', function (e) {
        $.ajax({
            url: url + '/op/permits/' + e.layer.feature.id,
            dataType: 'json',
            cache: false,
            success: function (permit, status) {
                e.layer.bindPopup(renderPopup(permit));
                e.layer.openPopup();
            },
            error: function (request, status, httpCode) {

            }
        });
    });
    permits.addTo(map);
    return permits;
}

function refreshMap(map) {
    var timeFrame = $('#timeframe').val();
    var types = $('#types').val();
    var includeClosed = $('#closed').is(':checked');
    var newLayers = [];
    $.each(permitLayers, function (index) {
        var oldLayer = this;
        oldLayer.removeFrom(map);
        var newLayer = setupOpenPermitLayer(map, oldLayer.options.url, timeFrame, includeClosed, types);
        newLayers.push(newLayer);
    });
    permitLayers.length = 0;
    permitLayers = newLayers;
}

function initFilters(map) {

    $('#timeframe').val('60d');
    $('#timeframe').on('change', function () {
        refreshMap(map);
    });

    $('#types').val('master');
    $('#types').on('change', function () {
        refreshMap(map);
    });

    $('#closed').on('change', function () {
        refreshMap(map);
    });

    $('#slide-submenu').on('click', function () {
        $(this).closest('.filters').fadeOut('slide', function () {
        });
        $('#search-suggest').css({ display: 'none' });
    });

    $('.mini-submenu').on('click', function () {
        $('.filters').fadeIn('slide');
        $('#search-suggest').css({ display: 'none' });
    })

    $('.dropdown-menu a').on('click', function () {
        var region = $(this).text();
        $('.dropdown-toggle').html('Region: ' + region + ' <span class="caret"></span>');

        switch (region) {
            case 'Miami-Dade County':
                map.setView([25.770640, -80.771738], 10);
                break;
            case 'Leon - Tallahassee':
                map.setView([30.440189, -84.284324], 11);
                break;
            case 'All Florida':
                map.setView([28.537286, -81.705865], 7);
                break;
        }
    });

    $('#search').on('keyup', function (e) {
        var value = $(this).val();
        var suggest = $('#search-suggest');
        if (e.keyCode == 13) {
            
        }
        else if (value.length > 3) {
            geocode(value, function (locations) {
                suggest.empty();
                $.each(locations, function (index) {
                    var location = this;
                    var li = $('<li><a tabindex="-1" href="#">' + location.address + '</a></li>');
                    li.data('location', location);
                    suggest.append(li);
                });

                $('li', suggest).on('click', function () {
                    var location = $(this).data('location');
                    map.setView([location.latitude, location.longitude], 17);
                    suggest.css({ display: 'none' });

                    var marker = suggest.data('marker');
                    if (marker) {
                        map.removeLayer(marker)
                    }
                    var pulsingIcon = L.icon.pulse({ iconSize: [12, 12], color: 'red' });
                    var marker = L.marker([location.latitude, location.longitude], { icon: pulsingIcon }).addTo(map);
                    suggest.data('marker', marker);
                });
                map.on('click', function (e) { suggest.css({ display: 'none' }) });
                suggest.css({ display: 'block' });
            });
        }

    });
}

function geocode(text, onResults) {
    jQuery.ajax({
        url: "https://dev.virtualearth.net/REST/v1/Locations/" + encodeURIComponent(text + ' ,US'),
        dataType: 'jsonp',
        data: {
            o: 'json',
            key: 'AiKeOEfaZcU2tUldbO--mTDhlcSJi2-NxqfbDcBAXB6x7ipGWzNjYGQtD_Iq931r'
        },
        jsonp: 'jsonp',
        success: function (addrObj) {
            if (addrObj && addrObj.resourceSets &&
                (addrObj.resourceSets.length > 0) &&
                (addrObj.resourceSets[0].resources) &&
                (addrObj.resourceSets[0].resources.length > 0)) {

                var results = addrObj.resourceSets[0].resources;
                var resultList = [];
                for (var i = 0; i < results.length; i++) {
                    if (results[i].entityType !== 'CountryRegion') {
                        var bingAddress = results[i].address;
                        var point = results[i].point;
                        var location = { 'address': bingAddress.formattedAddress, 'latitude': point.coordinates[0], 'longitude': point.coordinates[1] };
                        resultList.push(location);
                    }
                }
                if (resultList.length > 0) {
                    onResults(resultList);
                }
            }
        }
    });
}

function setupBasemapLayers(map, defaultLayer) {
    
    switch (defaultLayer) {
        case 'ESRI-IMAGERY':
            L.esri.basemapLayer('Imagery').addTo(map);
            L.esri.basemapLayer('ImageryLabels').addTo(map);
            break;
        case 'OSM':
            L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);
            break;
        case 'Google':
            // TODO add Google sample
            break;
    }
}

function main() {

    var map = L.map('map', { zoomControl: false }).setView([25.770640, -80.771738], 10);
    new L.Control.Zoom({ position: 'bottomleft' }).addTo(map);

    initFilters(map);

    // Modify this function to use desired basemap layers
    setupBasemapLayers(map, 'ESRI-IMAGERY');
    
    
    // Add permit layers here as desired

    // Leon County - Tallahassee permits layer
    var esriLayer = setupEsriPermitLayer(map, 'http://services.arcgis.com/ptvDyBs1KkcwzQNJ/arcgis/rest/services/Tallahassee_Leon_Permitting_2013to2015/FeatureServer/0',
                                    '60d', true, false);

    // Miami-Dade County permits Layer
    var permits = setupOpenPermitLayer(map, 'http://localhost:47072', '60d', false, 'master');
    permitLayers.push(permits);  
}

function formatDate(dateString) {
    if (dateString) {
        var date = new Date(dateString);
        return date.toLocaleDateString();
    }
    else {
        return '';
    }
}

function renderPopup(permit) {

    var html = '<div class="op-popup"><div class="well">Permit No: ' + permit.permitNum + '</div><table class="table table-condensed">';
    html += '<tr><td>Address:</td><td>' + permit.originalAddress1 + ', ' + permit.originalCity + ', ' + permit.originalState + ' ' + permit.originalZip + '</td></tr>';
    html += '<tr><td>Description:</td><td>' + permit.description + '</td></tr>';
    html += '<tr><td>Type:</td><td>' + permit.permitTypeDesc + '</td></tr>';
    html += '<tr><td>Status:</td><td>' + permit.statusCurrent + '</td></tr>';
    html += '<tr><td>Cost:</td><td> $' + permit.estProjectCost + '</td></tr>';
    html += '<tr><td>Contractor:</td><td>' + permit.contractorFullName + '</td></tr>';
    html += '</table><a class="btn btn-success btn-sm" href="http://www.epermithub.com/permit.html?pmt=eyJudW1iZXIiOiJCTEQxNC0wMDIwOSIsInR5cGUiOnsibmFtZSI6IkNvbW1lcmNpYWwgQWRkaXRpb24iLCJhZ2VuY3kiOnsiaWQiOiIwMDAxIiwibmFtZSI6IklzbGFudG9uLCBBY2NlbGEifX19" target="_blank">View More</a><br><br>';
    html += '<a href="http://www.miamidade.gov/permits/e-permitting.asp" target="_blank">Go to Miami-Dade County Permits</a>';
    html += '</div>';
    return html;
}

function renderLeonPopup(feature) {
    var html = '<div class="op-popup"><div class="well">Permit No: ' + feature.properties.PERMIT_NUM + '</div><table class="table table-condensed">';
    html += '<tr><td>Address:</td><td>' + feature.properties.ADDRESS + '</td></tr>';
    html += '<tr><td>Permit Class:</td><td>' + feature.properties.CLASS_DESC + '</td></tr>'
    html += '<tr><td>Permit Type:</td><td>' + feature.properties.TYPE_DESC + '</td></tr>';
    html += '<tr><td>Status:</td><td>' + feature.properties.PERMIT_STATUS + '</td></tr>';
    html += '<tr><td>Contractor:</td><td>' + feature.properties.CONTRACTOR + '</td></tr>';
    //html += '<tr><td>Issued Date:</td><td>' + formatDate(feature.properties.ISSUED_DT) + '</td></tr>';
    //if (feature.properties.COFO_DT) {
    //    html += '<tr><td>Completed Date:</td><td>' + formatDate(feature.properties.COFO_DT) + '</td></tr>';
    //}
    //html += '<tr><td>Status:</td><td>' + feature.properties.PERMIT_STATUS + '</td></tr>';
    //
    //html += '<tr><td>Permit Class:</td><td>' + feature.properties.CLASS_DESC + '</td></tr>';
    //html += '<tr><td>Permit Type:</td><td>' + feature.properties.TYPE_DESC + '</td></tr>';
    //html += '<tr><td>Parcel No:</td><td>' + feature.properties.PARCEL + '</td></tr>';
    //html += '<tr><td>Contractor:</td><td>' + feature.properties.CONTRACTOR + '</td></tr>';
    //html += '<tr><td>License No:</td><td>' + feature.properties.LICENSE_NO + '</td></tr>';
    html += '</table><a class="btn btn-success btn-sm" href="http://www.epermithub.com/permit.html?pmt=eyJudW1iZXIiOiJCTEQxNC0wMDIwOSIsInR5cGUiOnsibmFtZSI6IkNvbW1lcmNpYWwgQWRkaXRpb24iLCJhZ2VuY3kiOnsiaWQiOiIwMDAxIiwibmFtZSI6IklzbGFudG9uLCBBY2NlbGEifX19" target="_blank">View More</a><br><br>';
    if (feature.properties.PERMIT_NUM.substring(0, 2) === 'LB') {
        html += '<a href="https://www.velocityhall.com/accela/velohall/index.cfm?CITY=LEON%20COUNTY&STATE=FLORIDA" target="_blank">Go to Leon County Permits</a>';
    }
    else {
        html += '<a href="https://www.velocityhall.com/accela/velohall/index.cfm?CITY=TALLAHASSEE&STATE=FLORIDA" target="_blank">Go to Tallahassee Permits</a>';
    }
    html += '</div>';
    return html;
}