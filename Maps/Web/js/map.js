/*! OpenPermit Map Sample - v0.1.0
*   Copyright (c) 2015 OpenPermit Foundation, Inc.
*   MIT License*/
$(document).ready(function () {
    main();
});
function main() {
    var map = L.map('map').setView([25.745994, -80.281549], 11);

    L.esri.basemapLayer('Imagery').addTo(map);
    L.esri.basemapLayer('ImageryLabels').addTo(map);

    var permits = L.esri.clusteredFeatureLayer({
        url: 'http://services.arcgis.com/ptvDyBs1KkcwzQNJ/arcgis/rest/services/Tallahassee_Leon_Permitting_2013to2015/FeatureServer/0'
    }).addTo(map);

    var permits = L.esri.op.Layers.clusteredOpenPermitLayer({
        url: 'http://localhost:47072/'
    }).addTo(map);

    permits.bindPopup(function (feature) {
        return renderPopup(feature);
        //return L.Util.template('<div class="op-popup"><div class="well">Info</div><table class="table table-condensed"><tr><td>Permit</td><td>{PERMIT_NUM}</td></tr></table></div>', feature.properties);
    });

    var searchControl = L.esri.Geocoding.Controls.geosearch({
        placeholder: 'Enter place, address or permit number',
        title: "Search",
        providers: [
          new L.esri.Geocoding.Controls.Geosearch.Providers.FeatureLayer({
              url: '//services.arcgis.com/ptvDyBs1KkcwzQNJ/arcgis/rest/services/Tallahassee_Leon_Permitting_2013to2015/FeatureServer/0/',
              searchFields: ['PERMIT_NUM'],
              label: 'Permits',
              bufferRadius: 50,
              formatSuggestion: function (feature) {
                  return feature.properties.PERMIT_NUM + ' - ' + feature.properties.TYPE_DESC + ' - ' + feature.properties.ADDRESS;
              }
          })
        ]
    }).addTo(map);
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

function renderPopup(feature) {
    var html = '<div class="op-popup"><div class="well">Permit No: ' + feature.properties.PermitNum + '</div><table class="table table-condensed">';
    html += '<tr><td>Address:</td><td>' + feature.properties.OriginalAddress1 + ', ' + feature.properties.OriginalCity + ', ' + feature.properties.OriginalState + ' ' + feature.properties.OriginalZip + '</td></tr>';
    html += '<tr><td>Description:</td><td>' + feature.properties.Description + '</td></tr>';
    html += '<tr><td>Type:</td><td>' + feature.properties.PermitTypeDesc + '</td></tr>';
    html += '<tr><td>Cost:</td><td> $' + feature.properties.EstProjectCost + '</td></tr>';
    html += '<tr><td>Contractor:</td><td>' + feature.properties.ContractorFullName + '</td></tr>';
    html += '</table><a class="btn btn-success btn-sm" href="http://www.epermithub.com/permit.html?pmt=eyJudW1iZXIiOiJCTEQxNC0wMDIwOSIsInR5cGUiOnsibmFtZSI6IkNvbW1lcmNpYWwgQWRkaXRpb24iLCJhZ2VuY3kiOnsiaWQiOiIwMDAxIiwibmFtZSI6IklzbGFudG9uLCBBY2NlbGEifX19" target="_blank">View More</a><br><br>';
    html += '<a href="http://www.miamidade.gov/permits/e-permitting.asp" target="_blank">Go to Miami-Dade County Permits</a>';
    html += '</div>';
    return html;
}