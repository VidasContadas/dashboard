console.log("graphs.js loaded");
console.log("STATIC_URL = "+STATIC_URL);

queue()
    .defer(d3.json, STATIC_URL+"panel/data/data_2_min_2.json")
    .defer(d3.json, STATIC_URL+"panel/geojson/provincias.geojson")
    .await(makeGraphs);

var allRecords;
var ndx;
var apellidoDim;

//Grupos
var numByEdad;
var numBySuceso;
var numBySexo;
var numByProvincia;

var personaActiva = "";

$(document).ready(function(){

	
	$("body").on('click', '.list-person', function(){		
		var surname =  $(this).find(".surname").text();

		if($(this).hasClass("active")){
			console.log("deselect name");
			personaActiva ="";
			apellidoDim.filterAll();
		} else{
			
			console.log("Filtrando: "+surname);
			personaActiva = surname;		
			apellidoDim.filterFunction(function(d){
				if (d == surname){					
					return d;
				}
			});			

			
		}
		numByEdad.reduceCount();
		numBySuceso.reduceCount();
		numBySexo.reduceCount();
		numByProvincia.reduceCount();

		updateRecords(apellidoDim);
		
		dc.redrawAll();
		
		
	});



});



function updateRecords(dim){
	var rowCode = '<tr class="list-person"><td class="surname">##surname##</td><td class="name">##name##</td><td class="alias">##alias##</td></tr>';

	allRecords = dim.bottom(10);

	var table = $("#list-table");

	$("#list-table .list-person").not("active").remove();

	for (var i = 0; i < allRecords.length; i++){
		var personCode = rowCode.replace("##name##", allRecords[i].Nome);
		var personCode = personCode.replace("##surname##", allRecords[i].Apelidos);
		var personCode = personCode.replace("##alias##", allRecords[i].Apodo);
		var newRow = $(personCode);		
		if (allRecords[i].Apelidos == personaActiva){
			$(newRow).addClass("active");
		}
		$(table).append(newRow);
	}


}

function makeGraphs(error, articulosJson, galiciaJson) {
	
	console.log( Object.keys(articulosJson[0]));
	var twentysixers = 0;
	//Clean data
	for (var i = 0; i < articulosJson.length; i++){
		d = articulosJson[i];


		d['Sexo'].trim();

		switch (d['Sexo']){
			case ('Home' || 'Hombre'):
				d['Sexo'] = "Hombre";
				break;

			case 'Muller':
				d['Sexo'] = "Mujer";
				break;

			default:
				console.log("Posible fallo de datos (Sexo), se eliminará esta entrada:");
				console.log(d);
				articulosJson.splice(i,1);
				break;
		}

		d['Suceso'].trim();

		switch (d['Suceso']){
			case 'Desaparici?':
				d['Suceso'] = "Desaparición";
				break;

			case 'Detenci?':
				d['Suceso'] = "Detención";
				break;

			case 'Desaparici?':
				d['Suceso'] = "Desaparición";
				break;

			case 'Morte (outras tipolox?s)':
				d['Suceso'] = "Muerte (otras tipologías)";
				break;

			case 'Outras tipolox?s represivas':
				d['Suceso'] = "Otras tipologías represivas";
				break;

			case 'Sanci?':
				d['Suceso'] = "Sanción";

			default:
				break;
		}

		d['Apelidos'] = toTitleCase(d['Apelidos']);
	}

	//Create a Crossfilter instance
	ndx = crossfilter(articulosJson);


	//Define Dimensions
	
	var sexoDim = ndx.dimension(function(d) { 
		if (d["Sexo"] == "Home"){
			d["Sexo"] = "Hombre";
		}
		return d["Sexo"];
	});


	var sucesoDim = ndx.dimension(function(d) { 
		return d["Suceso"];
	});
	
	var edadDim = ndx.dimension(function(d) { 
		//if (d["Idade"] != 0){
			return d["Idade"];
		//}
	});

	apellidoDim = ndx.dimension(function(d){ return d["Apelidos"]});
	provinciaDim = ndx.dimension(function(d){ return d["NaturalProvincia"]});



	numBySexo = sexoDim.group();
	numBySuceso = sucesoDim.group();
	numByEdad = edadDim.group();
	numByProvincia = provinciaDim.group();


	var all = ndx.groupAll();

	updateRecords(apellidoDim);

    //Charts
	var sucesosRowChart = dc.rowChart("#sucesos-bar-chart");
	var sexoPieChart = dc.pieChart("#sexo-pie-chart");
	var edadBarChart = dc.barChart("#edad-chart");
	var mapChart = dc.geoChoroplethChart("#map-chart");


	//Get the minimum non-0 age
	var edades = numByEdad.top(Infinity);
	var min = 100;
	for (var i = 0; i < edades.length; i++){
		if (edades[i].key < min && edades[i].key != 0 ){
			min = edades[i].key;
		}
	}

	var minEdad = min;//edadDim.bottom(1)[0]["Idade"];
	var maxEdad = edadDim.top(1)[0]["Idade"];
	maxEdad++;

	var provinciasByNum = numByProvincia.top(Infinity);
	var maxProvincia = provinciasByNum[0].value;
	var minProvincia = provinciasByNum.slice(-1)[0].value;
	console.log("min-max provincias: "+minProvincia+" - " +maxProvincia);


    var projection = d3.geo.conicConformal().center([-3, 40]);;
   		projection = d3.geo.conicConformal()
  					.center([0, 42])
  					.scale(10000)
  					.translate([1125,300]);
   		
	edadBarChart
		.width(1000)
		.height(160)
		.margins({top: 10, right: 50, bottom: 30, left: 50})
		.dimension(edadDim)
		.group(numByEdad)
		.transitionDuration(500)
		.x(d3.scale.linear().domain([minEdad,maxEdad]))
		.elasticY(true)		
		.renderLabel(true)	
		.xAxisLabel("Year")
		.on("filtered", function (){
			updateRecords(apellidoDim);			
		})
		.yAxis().ticks(4);	

	sucesosRowChart
        .width(500)
        .height(250)
        .dimension(sucesoDim)
        .group(numBySuceso)    
        .ordering(function(d){ return d.calls;})
        .cap(7)
        .elasticX(true)	
        .othersGrouper(false) //Removes "Other" from the list
        .on("filtered", function (){
			updateRecords(apellidoDim);			
		})
        .xAxis().ticks(4);

    sexoPieChart
        .width(500)
        .height(250)
	    .slicesCap(3)
	    .innerRadius(40)
	    .dimension(sexoDim)
	    .group(numBySexo)
	    .legend(dc.legend())
	    .on("filtered", function (){
			updateRecords(apellidoDim);			
		});

	mapChart.width(1000)
	    .height(330)
	    .dimension(provinciaDim)
	    .group(numByProvincia)
	   	.colors(d3.scale.quantize().range(["#E2F2FF", "#C4E4FF", "#9ED2FF", "#81C5FF", "#6BBAFF", "#51AEFF", "#36A2FF", "#1E96FF", "#0089FF", "#0061B5"]))
        .colorDomain([0, maxProvincia])
	    .overlayGeoJson(galiciaJson["features"], "NaturalProvincia", function (d) {
	        return d.properties["name_2"];
	    })
	    
	    .projection(projection)
	    .title(function (p) {
	        return "NaturalProvincia: " + p["key"]
	                + "\n"
      	
	    })
		.on("filtered", function (){
			updateRecords(apellidoDim);			
		})
	    
    dc.renderAll();

};