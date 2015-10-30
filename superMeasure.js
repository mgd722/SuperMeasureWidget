require([
    "dojo/dom",
    "dojo/parser",

    "esri/map",
    "esri/dijit/Measurement",
    "esri/units",
    "esri/tasks/GeometryService",
    "esri/geometry/Point",
    "esri/symbols/TextSymbol",
    "esri/symbols/Font",
    "esri/layers/GraphicsLayer",
    "esri/graphic",

    "dijit/layout/BorderContainer",
    "dijit/layout/ContentPane",
    "dijit/TitlePane",
    "dijit/form/CheckBox", 
    "dojo/domReady!"
  ], function(
    dom, parser, Map, Measurement, Units, GeometryService, Point, TextSymbol, Font, GraphicsLayer, graphic
  ){
    parser.parse();

    var map = new Map("map", {
      basemap: "satellite",
      center: [-85.743, 38.256],
      zoom: 17
    });

    var segs = []; // Holds the two most recent measurement points
    var prevLineLength = 0; // The total length of the line excluding the most recent segment
    var measureText = new GraphicsLayer(); // Stores text graphics of segment lengths
    measureText.id = 'measureText';
    map.addLayer(measureText);

    // Hacky seeming way of getting the coordinates of the first point of the measure line
    function getCursorLocation(){
      var getCursorEvt = map.on('mouse-move', function(evt){
        segs.push(evt.mapPoint);
      });

      var removeGetCursorEvt = map.on('mouse-move', function(){
        getCursorEvt.remove();
        removeGetCursorEvt.remove();
      });
    }

    // Pass an array of two Point geometries, returns their midpoint as a new Point
    function getMidpoint(array){
      var pointX = (array[0].x+array[1].x)/2;
      var pointY = (array[0].y+array[1].y)/2;
      return new Point(pointX, pointY, array[0].spatialReference);
    }

    // Pass an array of two Point geometries, returns slope of the line that passes between them
    function getSlope(array){
        var m = (array[1].y-array[0].y)/(array[1].x-array[0].x);
        m = Math.atan(m)*(180/Math.PI);
        return m*-1;
    }

    // Returns a suitable label offset based on line slope
    function getOffset(slope){
      var x;
      if (slope > 0){
        x = 10;
      } else {
        x = -10;
      }
      return {x:x, y:10};
    }

    // Clears the graphics and resets the supporting variables to set up a new line
    function clearLineInfo(){
      prevLineLength = 0;
      segs = [];
      measureText.clear();
    }

    // Iterates through the graphics and updates the units as necessary
    function updateUnits(toolName, unitName){
      measureText.graphics.forEach(function(item){
        item.symbol.text = 'units changed';
      });
      measureText.redraw();
    }

    var measurement = new Measurement({
      map: map,
      defaultLengthUnit: Units.FEET
    }, dom.byId("measurementDiv"));
    measurement.startup();

    // Captures each completed segment and adds its length as a graphic
    measurement.on('measure', function(evt){
      // Only run if distance tool selected
      if (measurement.getTool().toolName !== 'distance'){
        return;
      }

      // Add new segment endpoint to list, remove the old one
      segs.push(evt.geometry);
      if (segs.length > 2){
        segs.splice(0,1);
      }

      // Calculate and format current segment length
      var segLength = evt.values - prevLineLength;
      segLength = segLength.toFixed(2);

      // Reset this value for the next segment's calculation
      prevLineLength = evt.values;

      // Gets/sets appropriate values for text symbol
      var slope = getSlope(segs);
      var offset = getOffset(slope);
      var font = new Font("12pt", Font.STYLE_NORMAL, Font.VARIANT_NORMAL, Font.WEIGHT_BOLD, "Helvetica");
      
      var textSymbol = new TextSymbol(segLength).setAngle(slope).setOffset(offset.x, offset.y).setFont(font);
      var midpoint = getMidpoint(segs);
      var segText = new graphic(midpoint, textSymbol);
      measureText.add(segText);
    });

    measurement.on('measure-start', function(){
      clearLineInfo();
      getCursorLocation(); // This is needed because on('measure') doesn't capture the first coordinate :(
    });

    measurement.on('tool-change', clearLineInfo);

    measurement.on('unit-change', updateUnits);
  }
);