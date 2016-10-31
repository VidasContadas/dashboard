queue()
    .defer(d3.json, STATIC_URL+"panel/data/data.json")
    .defer(d3.json, STATIC_URL+"panel/geojson/galicia.json")
    .await(makeGraphs);

var allRecords;
var ndx;
var idDim;

//Grupos
var numByEdad;
var numBySuceso;
var numBySexo;
var numByConcejo;

//Charts
var mapChart;

var personaActiva = -1;
var maxConcejo = 0;


$(document).ready(function(){


	$("body").on('click', '.list-person', function(){

		if($(this).hasClass("active")){
			//Deselect person
			personaActiva = -1;
			idDim.filterAll();
		} else{
			//Select person
			var id =  $(this).attr("data-id");
			personaActiva = id;
			idDim.filterFunction(function(d){
				if (d == id){
					return d;
				}
			});


		}
		numByEdad.reduceCount();
		numBySuceso.reduceCount();
		numBySexo.reduceCount();
		numByConcejo.reduceCount();

		updateRecords(idDim);

		dc.redrawAll();

	});



});


function updateRecords(dim){
	var rowCode = '<tr class="list-person" data-id="##id##"><td class="surname">##surname##</td><td class="name">##name##</td><td class="alias">##alias##</td></tr>';


	maxConcejo = concejoDim.group().top(1)[0].value;
	if (mapChart !== undefined){
        mapChart.colorDomain([0, maxConcejo]);
        console.log("max concejo:" +maxConcejo);
	}

	dc.redrawAll();

	allRecords = dim.bottom(5);

	var table = $("#list-table");

	$("#list-table .list-person").not("active").remove();

	for (var i = 0; i < allRecords.length; i++){
		var personCode = rowCode.replace("##name##", allRecords[i].Nome);
		var personCode = personCode.replace("##surname##", allRecords[i].Apelidos);
		var personCode = personCode.replace("##alias##", allRecords[i].Apodo);
		var personCode = personCode.replace("##id##", allRecords[i].id);
		var newRow = $(personCode);
		if (allRecords[i].id == personaActiva){
			$(newRow).addClass("active");
		}
		$(table).append(newRow);
	}


}

function cleanData(datos){
	//Clean data
	for (var i = 0; i < datos.length; i++){

		d = datos[i];

		d['id'] = i+1; //add id to every entry. +1 because starting with 0 made the first one not to work.

		d['Sexo'].trim();

        if( d['Apelidos'] == "Romero Menaya"){
            console.log("Romero Menaya");
        }
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
				datos.splice(i,1);

				break;
		}

		d['Suceso'].trim();

		switch (d['Suceso']){

			case 'Morte (outras tipoloxías)':
				d['Suceso'] = "Muerte (otras tipologías)";
				break;

			case 'Outras tipoloxías represivas':
				d['Suceso'] = "Otras tipologías represivas";
				break;

			default:
				break;
		}

	d['Apelidos'] = toTitleCase(d['Apelidos']);
    d['NaturalConcello'] = d['Natural Concello'];

	}


	return datos;

}

function makeGraphs(error, datos, galiciaJson) {

	console.log( Object.keys(datos[0]));
	var twentysixers = 0;

	datos = cleanData(datos);

    for (var i = 0; i < datos.length; i++){
        if (d["id"] === undefined ){
            console.log("ID UNDEFINED!");
        }
    }

	//Create a Crossfilter instance
	ndx = crossfilter(datos);


	//Define Dimensions

	var sexoDim = ndx.dimension(function(d) {
		if (d["Sexo"] == "Home"){
			d["Sexo"] = "Hombre";
		}
		return d["Sexo"] ? d["Sexo"] : "";
	});


	var sucesoDim = ndx.dimension(function(d) {
		return d["Suceso"] ? d["Suceso"] : "";
	});

	var edadDim = ndx.dimension(function(d) {
		//if (d["Idade"] != 0){
		return d["Idade"] ? d["Idade"] : 0;
		//}
	});

	idDim = ndx.dimension(function(d){
        if (d["id"] !== undefined ){
            return d["id"];
        }
         console.log("---- ID ERROR ---");
         console.log(d);
         return 0;
      });

	concejoDim = ndx.dimension(function(d){
        return d["NaturalConcello"] ? d["NaturalConcello"] : 0;
      });



	numBySexo = sexoDim.group();
	numBySuceso = sucesoDim.group();
	numByEdad = edadDim.group();
	numByConcejo = concejoDim.group();


	var all = ndx.groupAll();

	updateRecords(idDim);

    //Charts
	var sucesosRowChart = dc.rowChart("#sucesos-bar-chart");
	var sexoPieChart = dc.pieChart("#sexo-pie-chart");
	var edadBarChart = dc.barChart("#edad-chart");
	mapChart = dc.geoChoroplethChart("#map-chart");


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

	var concejoByNum = numByConcejo.top(Infinity);
	maxConcejo = concejoDim.group().top(1)[0].value
	var minConcejo = concejoByNum.slice(-1)[0].value;
	console.log("min-max concejo: "+minConcejo+" - " +maxConcejo);


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
			updateRecords(idDim);
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
			updateRecords(idDim);
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
			updateRecords(idDim);
		});

	mapChart.width(1000)
	    .height(330)
	    .dimension(concejoDim)
	    .group(numByConcejo)
	   	//.colors(d3.scale.quantize().range(["#E2F2FF", "#C4E4FF", "#9ED2FF", "#81C5FF", "#6BBAFF", "#51AEFF", "#36A2FF", "#1E96FF", "#0089FF", "#0061B5"]))
        .colors(["#E2F2FF", "#618FAF", "#5586A7", "#4A7DA0", "#3E7499", "#326B92", "#27628A", "#1B5983", "#0F507C", "#044775"])
        .colorDomain([0, maxConcejo])
	    .overlayGeoJson(galiciaJson["features"], "NaturalProvincia", function (d) {
	        return d.properties["name_4"];
	    })
	     .colorAccessor(function(d) {
	     	if (d === undefined){
	     		return 0;
	     	}
            return d;
        })

	    .projection(projection)
	    .title(function (p) {
	    	if (p["value"] === undefined){
	    		p["value"] = "Sin datos";
	    	}
	        return p["key"] + ": "+ p["value"]
	                + "\n"

	    })
		.on("filtered", function (){
			updateRecords(idDim);
		})

    dc.renderAll();

};
