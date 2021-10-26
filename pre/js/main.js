import html2canvas from 'html2canvas';
import { getInTooltip, getOutTooltip, positionTooltip } from './tooltip';
import { setRRSSLinks } from './rrss';
import { numberWithCommas, numberWithCommas2 } from './helpers';
import 'url-search-params-polyfill';
import * as d3 from 'd3';

//Necesario para importar los estilos de forma automática en la etiqueta 'style' del html final
import '../css/main.scss';

///// VISUALIZACIÓN DEL GRÁFICO //////
let dataSources = [
    'https://raw.githubusercontent.com/CarlosMunozDiazCSIC/pruebas-fecundidad/main/data/prov_fec.csv',
    'https://raw.githubusercontent.com/CarlosMunozDiazCSIC/pruebas-fecundidad/main/data/ccaa_fec.csv',
    'https://raw.githubusercontent.com/CarlosMunozDiazCSIC/pruebas-fecundidad/main/data/provincias.json',    
    'https://raw.githubusercontent.com/CarlosMunozDiazCSIC/pruebas-fecundidad/main/data/ccaa.json'
];
let tooltip = d3.select('#tooltip');

//Variables para visualización
let currentRegion = 'ccaa', currentViz = 'slider'; //Otras opciones, 'provincias' y 'heatmap'
let ccaaData = [], provData = [], ccaaMap, provMap;

initData();

function initData() {
    let q = d3.queue();

    q.defer(d3.text, dataSources[0]);
    q.defer(d3.text, dataSources[1]);
    q.defer(d3.json, dataSources[2]);
    q.defer(d3.json, dataSources[3]);

    q.await(function(err, provData, ccaaData, provAuxmap, ccaaAuxmap) {
        if (err) throw err;
    });
}

// MAPA CON SLIDER //
//Lógica del slider
let currentValue = 2020;
const firstValue = 1975;
const lastValue = 2020;
const yearsDifference = (lastValue - firstValue) + 1;

let sliderRange = document.getElementById('slider');
let sliderDate = document.getElementById('sliderDate');
let playButton = document.getElementById('btnPlay');
let pauseButton = document.getElementById('btnPause');
let sliderInterval;

/* 
* Funciones para configurar el timeslider (en consonancia con los datos del archivo) 
*/
function createTimeslider(){
    let size = yearsDifference, step = 1;
    sliderRange.size = size;
    sliderRange.min = firstValue;
    sliderRange.max = lastValue;
    sliderRange.step = step;
    sliderRange.value = lastValue;

    /* Los siguientes eventos tienen la capacidad de modificar lo que se muestra en el mapa */
    playButton.onclick = function () {
        sliderInterval = setInterval(setNewValue,1000);
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
    updateMap(currentValue);

    if (currentValue == 2020) {
        clearInterval(sliderInterval);
        playButton.style.display = 'inline-block';
        pauseButton.style.display = 'none';
    }
}

function showSliderDate(currentValue){
    sliderDate.textContent = currentValue;
}

//Mapa
function initMap() {

}

function updateMap() {

}


initMap();
createTimeslider();



// MAPA DE CALOR //



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
    console.log(tipo);
}

function updateViz(viz) {
    let vizs = document.getElementsByClassName('chart__viz');

    for(let i = 0; i < vizs.length; i++) {
        vizs[i].classList.remove('active');
    }

    document.getElementsByClassName(`chart__viz--${viz}`)[0].classList.add('active');
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