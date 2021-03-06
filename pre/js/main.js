import html2canvas from 'html2canvas';
import { getInTooltip, getOutTooltip, positionTooltip } from './tooltip';
import { setRRSSLinks } from './rrss';
import { numberWithCommas, numberWithCommas2 } from './helpers';
import 'url-search-params-polyfill';
//Desarrollo de visualizaciones
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
let d3_composite = require("d3-composite-projections");

//Necesario para importar los estilos de forma automática en la etiqueta 'style' del html final
import '../css/main.scss';

///// VISUALIZACIÓN DEL GRÁFICO //////
let dataSources = [
    'https://raw.githubusercontent.com/CarlosMunozDiazCSIC/prueba-fecundidad-slider-heatmap/main/data/prov_fec.csv',
    'https://raw.githubusercontent.com/CarlosMunozDiazCSIC/prueba-fecundidad-slider-heatmap/main/data/ccaa_fec.csv',
    'https://raw.githubusercontent.com/CarlosMunozDiazCSIC/prueba-fecundidad-slider-heatmap/main/data/provincias.json',    
    'https://raw.githubusercontent.com/CarlosMunozDiazCSIC/prueba-fecundidad-slider-heatmap/main/data/ccaa.json'
];
let tooltip = d3.select('#tooltip');

//Variables para visualización
let currentRegion = 'ccaa', currentViz = 'slider'; //Otras opciones, 'provincias' y 'heatmap'
let ccaaData = [], provData = [], ccaaMap, provMap;
let mapBlock = d3.select('#slider-viz'), mapSvg, projection, path, heatmapBlock = d3.select('#heatmap'), heatmapSvg;

let colors = function(data) {
    if(data < 1.16) {
        return '#6c0000';
    } else if(data >= 1.16 && data < 1.31) {
        return '#da6d56';
    } else if (data >= 1.31 && data < 1.45) {
        return '#CCDDD9';
    } else if (data >= 1.45 && data < 1.97) {
        return '#528379';
    } else {
        return '#11473C';
    }
}

initData();

function initData() {
    let q = d3.queue();
    const csv = d3.dsvFormat(";");

    q.defer(d3.text, dataSources[0]);
    q.defer(d3.text, dataSources[1]);
    q.defer(d3.json, dataSources[2]);
    q.defer(d3.json, dataSources[3]);

    q.await(function(err, prov, ccaa, provAuxmap, ccaaAuxmap) {
        if (err) throw err;

        //Datos en CSV
        provData = csv.parse(prov);
        ccaaData = csv.parse(ccaa);

        //Mapas
        provMap = topojson.feature(provAuxmap, provAuxmap.objects['provincias']);
        ccaaMap = topojson.feature(ccaaAuxmap, ccaaAuxmap.objects['ccaa']);        

        //Integración de los datos en las capas de polígonos
        ccaaMap.features.map(function(item) {
            let data = ccaaData.filter(function(subItem) {
                if(parseInt(subItem['id_ccaa']) == parseInt(item.properties.cod_ccaa)){
                    return subItem;
                }
            });

            item.properties.data = data;
        });

        provMap.features.map(function(item) {
            let data = provData.filter(function(subItem) {
                if(parseInt(subItem['id_prov']) == parseInt(item.properties.cod_prov)){
                    return subItem;
                }
            });

            item.properties.data = data;
        });
        
        //Montamos las dos visualizaciones por defecto
        initMap();
        createTimeslider();
        initHeatmap();

        setTimeout(() => {
            setChartCanvas();
        }, 5000);
    });
}

// MAPA CON SLIDER //
//Lógica del slider
let currentValue = 2020;
const firstValue = 1975;
const lastValue = 2020;
const yearsDifference = lastValue - firstValue;

let sliderRange = document.getElementById('slider');
let sliderDate = document.getElementById('sliderDate');
let playButton = document.getElementById('btnPlay');
let pauseButton = document.getElementById('btnPause');
let sliderInterval;

/* 
* Funciones para configurar el timeslider (en consonancia con los datos del archivo) 
*/
function createTimeslider(){
    let step = 1;

    sliderRange.min = firstValue;
    sliderRange.max = lastValue;
    sliderRange.step = step;
    sliderRange.value = lastValue;

    /* Los siguientes eventos tienen la capacidad de modificar lo que se muestra en el mapa */
    playButton.onclick = function () {
        sliderInterval = setInterval(setNewValue,600);
        playButton.style.display = 'none';
        pauseButton.style.display = 'inline-block';    
    }

    pauseButton.onclick = function () {
        clearInterval(sliderInterval);
        playButton.style.display = 'inline-block';
        pauseButton.style.display = 'none';
    }

    sliderRange.oninput = function () {
        let currentValue = parseInt(sliderRange.value);
        setNewValue(currentValue);
    }
}

function setNewValue() {    
    let value = parseInt(sliderRange.value);
    if(value == lastValue) {
        sliderRange.value = firstValue;
    } else {
        sliderRange.value = value + 1;
    }
    currentValue = sliderRange.value;

    showSliderDate(currentValue);
    updateSliderMap(currentValue, currentRegion);

    if (currentValue == 2020) {
        clearInterval(sliderInterval);
        playButton.style.display = 'inline-block';
        pauseButton.style.display = 'none';
    }        
}

function showSliderDate(currentValue){
    sliderDate.textContent = currentValue;
}

function stopSlider() {
    sliderRange.value = lastValue;
    currentValue = sliderRange.value;

    showSliderDate(currentValue);
    updateSliderMap(currentValue, currentRegion);

    if (currentValue == 2020) {
        clearInterval(sliderInterval);
        playButton.style.display = 'inline-block';
        pauseButton.style.display = 'none';
    } 
}

//Mapa
function initMap() {
    //Damos una altura al bloque del mapa
    document.getElementById('slider-viz').style.height = (440 - document.getElementsByClassName('b-slider')[0].clientHeight) + 'px';

    //Iniciamos la configuración del mapa
    mapSvg = mapBlock.append('svg')
        .attr("height", parseInt(mapBlock.style('height')))
        .attr("width", parseInt(mapBlock.style('width')));
    
    projection = d3_composite.geoConicConformalSpain().scale(2000).fitSize([parseInt(mapBlock.style('width')),parseInt(mapBlock.style('height'))], ccaaMap);
    path = d3.geoPath(projection);

    mapSvg.selectAll(`.${currentRegion}-map`)
        .data(ccaaMap.features)
        .enter()
        .append('path')
        .attr('class', `${currentRegion}-map`)
        .attr('d', path)
        .style('fill', function(d) {
            let data = d.properties.data.filter(function(item) {
                if(parseInt(item.anio) == currentValue){
                    return item;
                }
            });
            return colors(parseFloat(data[0].ind_fec.replace(',','.')));
        })
        .style('stroke', '#cecece')
        .style('stroke-width', '1px')
        .on('mouseover', function(d, i, e) {
            //Línea diferencial y cambio del polígonos
            let currentCCAA = this;
                
            document.getElementsByTagName('svg')[0].removeChild(this);
            document.getElementsByTagName('svg')[0].appendChild(currentCCAA);

            currentCCAA.style.stroke = '#000';
            currentCCAA.style.strokeWidth = '1.5px';

            let dato = d.properties.data.filter(function(item) { if(item.anio == currentValue) { return item; } });

            //Pintamos el HTML
            let html = `<p class="chart__tooltip--title">${d.properties.name} (${currentValue})</p>
                <p class="chart__tooltip--text">Indicador coyuntural de fecundidad: ${dato[0].ind_fec}</p>`;

            tooltip.html(html);

            //Tooltip
            positionTooltip(window.event, tooltip);
            getInTooltip(tooltip);
        })
        .on('mouseout', function(d) {
            //Línea diferencial
            this.style.stroke = '#cecece';
            this.style.strokeWidth = '1px';

            //Quitamos el tooltip
            getOutTooltip(tooltip); 
        });

    //Islas Canarias
    mapSvg.append('path')
        .style('fill', 'none')
        .style('stroke', '#000')
        .attr('d', projection.getCompositionBorders());
}

function updateSliderMap(anio, tipo) {
    mapSvg.selectAll(`.${tipo}-map`)
        .style('fill', function(d) {
            let data = d.properties.data.filter(function(item) {
                if(parseInt(item.anio) == anio){
                    return item;
                }
            });
            return colors(parseFloat(data[0].ind_fec.replace(',','.')));
        });
}

function updateMap(tipo) {
    mapSvg.selectAll(`.${currentRegion}-map`).remove();

    let aux = tipo == 'ccaa' ? ccaaMap : provMap;
    mapSvg.selectAll(`.${tipo}-map`)
        .data(aux.features)
        .enter()
        .append('path')
        .attr('class', `${tipo}-map`)
        .attr('d', path)
        .style('fill', function(d) {
            let data = d.properties.data.filter(function(item) {
                if(parseInt(item.anio) == currentValue){
                    return item;
                }
            });
            return colors(parseFloat(data[0].ind_fec.replace(',','.')));
        })
        .style('stroke', '#cecece')
        .style('stroke-width', '1px')
        .on('mouseover', function(d, i, e) {
            //Línea diferencial y cambio del polígonos
            let currentCCAA = this;
                
            document.getElementsByTagName('svg')[0].removeChild(this);
            document.getElementsByTagName('svg')[0].appendChild(currentCCAA);

            currentCCAA.style.stroke = '#000';
            currentCCAA.style.strokeWidth = '1.5px';

            //Pintamos el HTML
            let dato = d.properties.data.filter(function(item) { if(item.anio == currentValue) { return item; } });
            let html = `<p class="chart__tooltip--title">${d.properties.name} (${currentValue})</p>
                <p class="chart__tooltip--text">Indicador coyuntural de fecundidad: ${dato[0].ind_fec}</p>`;

            tooltip.html(html);

            //Tooltip
            positionTooltip(window.event, tooltip);
            getInTooltip(tooltip);
        })
        .on('mouseout', function(d) {
            //Línea diferencial
            this.style.stroke = '#cecece';
            this.style.strokeWidth = '1px';

            //Quitamos el tooltip
            getOutTooltip(tooltip); 
        });
}

// MAPA DE CALOR //
function initHeatmap() {
    let margin = {top: 25, right: 12.5, bottom: 5, left: 110};
    let width = parseInt(d3.select('.chart__b-viz').style('width')) - margin.left - margin.right - 6;
    let height = parseInt(d3.select('.chart__b-viz').style('height')) - margin.top - margin.bottom - 15;

    heatmapSvg = heatmapBlock.append('svg')
        .attr("height", height + margin.top + margin.bottom)
        .attr("width", width + margin.left + margin.right)
        .append("g")
        .attr("transform","translate(" + margin.left + "," + margin.top + ")");

    //Nos quedamos con los grupos apropiados
    let ejeY = d3.nest()
        .key(function(d) { return d.abrev_ccaa; })
        .entries(ccaaData);    

    ejeY = sort_aux(ejeY);
    ejeY = ejeY.map(function(item) { return item.key; });    

    let ejeX = d3.nest()
        .key(function(d) { return d.anio; })
        .entries(ccaaData);

    ejeX = ejeX.map(function(item) { return item.key; });

    //Eje X
    let x = d3.scaleBand()
        .range([0, width])
        .domain(ejeX);

    let xAxis = function(g) {
        g.call(d3.axisTop(x).tickValues(x.domain().filter(function(d,i){
            return !(i%9);          
        })));
        g.call(function(g){g.select('.domain').remove()});
        g.call(function(g){g.selectAll('.tick line').remove()});
    }
    
    heatmapSvg.append("g")
        .attr("transform", "translate(0,0)")
        .call(xAxis);

    let y = d3.scaleBand()
        .range([ height, 0 ])
        .domain(ejeY);
    
    let yAxis = function(g) {
        g.call(d3.axisLeft(y));
        g.call(function(g){g.select('.domain').remove()});
        g.call(function(g){g.selectAll('.tick line').remove()});
    }
    
    heatmapSvg.append("g")
        .call(yAxis);

    //Datos
    heatmapSvg.selectAll(`${currentRegion}-heat`)
        .data(ccaaData, function(d) { return d.abrev_ccaa+':'+d.anio; })
        .enter()
        .append("rect")
        .attr('class', `${currentRegion}-heat`)
        .attr("x", function(d) { return x(d.anio) })
        .attr("y", function(d) { return y(d.abrev_ccaa) })
        .attr("width", x.bandwidth() )
        .attr("height", y.bandwidth() )
        .style("fill", function(d) { return colors(d.ind_fec.replace(',','.'))} )
        .on('mouseover', function(d, i, e) {
            //Línea diferencial y cambio del polígonos
            let currentCCAA = this;
                
            document.getElementsByTagName('svg')[1].getElementsByTagName('g')[0].removeChild(this);
            document.getElementsByTagName('svg')[1].getElementsByTagName('g')[0].appendChild(currentCCAA);

            currentCCAA.style.stroke = '#000';
            currentCCAA.style.strokeWidth = '1.5px';

            //Texto
            let html = `<p class="chart__tooltip--title">${d.abrev_ccaa} (${d.anio})</p>
                <p class="chart__tooltip--text">Indicador coyuntural de fecundidad: ${d.ind_fec}</p>`;

            tooltip.html(html);

            //Tooltip
            positionTooltip(window.event, tooltip);
            getInTooltip(tooltip);
        })
        .on('mouseout', function(d) {
            //Línea diferencial
            this.style.stroke = 'none';
            this.style.strokeWidth = '0px';

            //Quitamos el tooltip
            getOutTooltip(tooltip); 
        });
}

function updateHeatmap(tipo) {
    //Removemos lo que había previamente
    heatmapBlock.selectAll(`*`).remove();

    //Configuramos los nuevos datos
    let margin = {top: 25, right: 12.5, bottom: 5, left: 110};
    let width = parseInt(d3.select('.chart__b-viz').style('width')) - margin.left - margin.right - 6;
    let height = tipo == 'ccaa' ? parseInt(d3.select('.chart__b-viz').style('height')) - margin.top - margin.bottom - 15 : 870;

    heatmapSvg = heatmapBlock.append('svg')
        .attr("height", height + margin.top + margin.bottom)
        .attr("width", width + margin.left + margin.right)
        .append("g")
        .attr("transform","translate(" + margin.left + "," + margin.top + ")");

    let aux = tipo == 'ccaa' ? ccaaData : provData;
    let aux2 = tipo == 'ccaa' ? 'abrev_ccaa' : 'abrev_prov';

    //Nos quedamos con los grupos apropiados
    let ejeY = d3.nest()
        .key(function(d) { return d[aux2]; })
        .entries(aux);

    ejeY = sort_aux(ejeY);
    ejeY = ejeY.map(function(item) { return item.key; });    

    let ejeX = d3.nest()
        .key(function(d) { return d.anio; })
        .entries(aux);

    ejeX = ejeX.map(function(item) { return item.key; });

    //Eje X
    let x = d3.scaleBand()
        .range([0, width])
        .domain(ejeX);
    
    let xAxis = function(g) {
        g.call(d3.axisTop(x).tickValues(x.domain().filter(function(d,i){
            return !(i%9);          
        })));
        g.call(function(g){g.select('.domain').remove()});
        g.call(function(g){g.selectAll('.tick line').remove()});
    }
    
    heatmapSvg.append("g")
        .attr("transform", "translate(0,0)")
        .call(xAxis);

    let y = d3.scaleBand()
        .range([ height, 0 ])
        .domain(ejeY);

    let yAxis = function(g) {
        g.call(d3.axisLeft(y));
        g.call(function(g){g.select('.domain').remove()});
        g.call(function(g){g.selectAll('.tick line').remove()});
    }
    
    heatmapSvg.append("g")
        .call(yAxis);

    heatmapSvg.selectAll(`${tipo}-heat`)
        .data(aux, function(d) { return d[aux2] + ':' + d.anio; })
        .enter()
        .append("rect")
        .attr('class', `${tipo}-heat`)
        .attr("x", function(d) { return x(d.anio) })
        .attr("y", function(d) { return y(d[aux2]) })
        .attr("width", x.bandwidth() )
        .attr("height", y.bandwidth() )
        .style("fill", function(d) { return colors(d.ind_fec.replace(',','.'))} )
        .on('mouseover', function(d, i, e) {
            //Línea diferencial y cambio del polígonos
            let currentCCAA = this;
                
            document.getElementsByTagName('svg')[1].getElementsByTagName('g')[0].removeChild(this);
            document.getElementsByTagName('svg')[1].getElementsByTagName('g')[0].appendChild(currentCCAA);

            currentCCAA.style.stroke = '#000';
            currentCCAA.style.strokeWidth = '1.5px';

            //Texto
            let html = `<p class="chart__tooltip--title">${d[aux2]} (${d.anio})</p>
                <p class="chart__tooltip--text">Indicador coyuntural de fecundidad: ${d.ind_fec}</p>`;

            tooltip.html(html);

            //Tooltip
            positionTooltip(window.event, tooltip);
            getInTooltip(tooltip);
        })
        .on('mouseout', function(d) {
            //Línea diferencial
            this.style.stroke = 'none';
            this.style.strokeWidth = '0px';

            //Quitamos el tooltip
            getOutTooltip(tooltip); 
        });
}

function sort_aux(ejes) {
    let aux = [];
    for(let i = 0; i < ejes.length; i++) {
        let data = ejes[i].values;
        let mean = d3.mean(data, function(d) { return +d.ind_fec.replace(',','.')});
        aux.push({'key':ejes[i].key, 'mean': mean});
    }
    //Ordenación del auxiliar
    aux.sort(function(x, y){
        return d3.descending(x.mean, y.mean);
    });
    return aux;        
}

// Módulos para visualizar unos bloques u otros
let regionBtns = document.getElementsByClassName('btn__chart--first');
let vizBtns = document.getElementsByClassName('btn__chart--second');

for(let i = 0; i < regionBtns.length; i++) {
    regionBtns[i].addEventListener('click', function(e) {
        //Cambiar estilos
        for(let j = 0; j < regionBtns.length; j++) {
            regionBtns[j].classList.remove('active');
        }
        this.classList.add('active');

        //Cambiar tipo de dato
        updateRegion(this.getAttribute('data-type'));
    });
}

for(let i = 0; i < vizBtns.length; i++) {
    vizBtns[i].addEventListener('click', function(e) {
        //Cambiar estilos
        for(let j = 0; j < vizBtns.length; j++) {
            vizBtns[j].classList.remove('active');
        }
        this.classList.add('active');

        //Cambiar visualización
        updateViz(this.getAttribute('data-type'));
    });
}

//Modificación de regiones y visualizaciones
function updateRegion(tipo) {
    updateHeatmap(tipo);
    updateMap(tipo);

    currentRegion = tipo;
}

function updateViz(viz) {
    let vizs = document.getElementsByClassName('chart__viz');

    for(let i = 0; i < vizs.length; i++) {
        vizs[i].classList.remove('active');
    }

    document.getElementsByClassName(`chart__viz--${viz}`)[0].classList.add('active');
    stopSlider();
}

///// REDES SOCIALES /////
setRRSSLinks();

///// ALTURA DEL BLOQUE DEL GRÁFICO //////
function getIframeParams() {
    const params = new URLSearchParams(window.location.search);
    const iframe = params.get('iframe');

    if(iframe == 'fijo') {
        setChartHeight('fijo');
    } else {
        setChartHeight();
    }
}

///Si viene desde iframe con altura fija, ejecutamos esta función. Si no, los altos son dinámicos a través de PYMJS
function setChartHeight(iframe_fijo) {
    if(iframe_fijo) {
        //El contenedor y el main reciben una altura fija. En este caso, 688 y 656
        //La altura del gráfico se ajusta más a lo disponible en el main, quitando títulos, lógica, ejes y pie de gráfico
        document.getElementsByClassName('container')[0].style.height = '700px';
        document.getElementsByClassName('main')[0].style.height = '668px';

        let titleBlock = document.getElementsByClassName('b-title')[0].clientHeight;
        let logicBlock = document.getElementsByClassName('chart__logics')[0].clientHeight;
        let footerBlock = document.getElementsByClassName('chart__footer')[0].clientHeight;
        let footerTop = 8, containerPadding = 8, marginTitle = 8, marginLogics = 12;

        //Comprobar previamente la altura que le demos al MAIN. El estado base es 588 pero podemos hacerlo más o menos alto en función de nuestros intereses

        let height = 668;
        document.getElementsByClassName('chart__viz')[0].style.height = height - titleBlock - logicBlock - footerBlock - footerTop - containerPadding - marginTitle - marginLogics + 'px';
    } else {
        document.getElementsByClassName('main')[0].style.height = document.getElementsByClassName('main')[0].clientHeight + 'px';
    }    
}

getIframeParams();

///// DESCARGA COMO PNG O SVG > DOS PASOS/////
let innerCanvas;
let pngDownload = document.getElementById('pngImage');

function setChartCanvas() {
    html2canvas(document.querySelector("#chartBlock"), {width: document.querySelector('#chartBlock').clientWidth, height: document.querySelector('#chartBlock').clientHeight, imageTimeout: 12000, useCORS: true}).then(canvas => { innerCanvas = canvas; });
}

function setChartCanvasImage() {    
    var image = innerCanvas.toDataURL();
    // Create a link
    var aDownloadLink = document.createElement('a');
    // Add the name of the file to the link
    aDownloadLink.download = 'prueba-fecundidad.png';
    // Attach the data to the link
    aDownloadLink.href = image;
    // Get the code to click the download link
    aDownloadLink.click();
}

pngDownload.addEventListener('click', function(){
    setChartCanvasImage();
});

///// JUEGO DE PESTAÑAS /////
//Cambios de pestañas
let tabs = document.getElementsByClassName('tab');
let contenidos = document.getElementsByClassName('content');

for(let i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function(e) {
        document.getElementsByClassName('main')[0].scrollIntoView();
        displayContainer(e.target);
    });
}

function displayContainer(elem) {
    let content = elem.getAttribute('data-target');

    //Poner activo el botón
    for(let i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }
    elem.classList.add('active');

    //Activar el contenido
    for(let i = 0; i < contenidos.length; i++) {
        contenidos[i].classList.remove('active');
    }

    document.getElementsByClassName(content)[0].classList.add('active');
}