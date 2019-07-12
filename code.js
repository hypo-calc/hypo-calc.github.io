"use strict";

var model = {
    input : { values : {}, calendar: null },
    output: { values : {}, calendar: null }
};

function getInputData() {
    var data = {};
    config.formEditableValues.forEach(
        x => data[x] = parseFloat(document.getElementById(x).value, 10)
    );

    // validate fractionProceed
    if (data.fractionProceed < 0) data.fractionProceed = 0;
    if (data.fractionProceed >= data.fractionCount) data.fractionProceed = data.fractionCount-1;

    return data; 
}

function calcFormValues(data) {
    const workingDaysInWeek = 5;
    const offDaysInWeek = 2;
    const weekAligned = data.fractionCount + data.dayOfWeek;    
    const rem = weekAligned % workingDaysInWeek;
    data.treatmentWeeks = (weekAligned - rem) / workingDaysInWeek + (rem > 0 ? 1:0);
    data.offDays = (data.treatmentWeeks - 1) * offDaysInWeek;
    data.treatmentDays = data.fractionCount + data.offDays;
    data.totalDose = data.fractionCount * data.fraction;
    data.EQD2 = getEquivalentQuantityDose(data.fractionCount, data.fraction, data.alphabeta);
    data.receivedDose = getEquivalentQuantityDose(data.fractionProceed, data.fraction, data.alphabeta);
    data.remainingDose = getEquivalentQuantityDose(data.fractionCount - data.fractionProceed, data.fraction, data.alphabeta);
}

function fillReadonlyFormData(data) {
    config.formReadonlyValues.forEach(
        x => document.getElementById(x).value = data[x]
    );
}

function attachFormEvents() {
    config.formEditableValues.forEach(
        x => document.getElementById(x).addEventListener("change", inputDataChanged)
    );
    var content = document.getElementById("calendar-content");
    content.addEventListener("click", calendarClick, false);
}

function calendarClick(event) {
    for (var el = event.target; el && !el.id.startsWith("c"); el = el.parentElement) {}
    if (!el) return;
    const id = parseInt(el.id.substring(1), 10);
    const input = model.input.values;
    const proceed = input.fractionProceed;
    if (proceed==0) {
        if (id < input.dayOfWeek) return;
    } else {
        const lastReadonlyDay = model.input.calendar.weeks.find(
            x => x.fraction == proceed
        );
        if (id <= lastReadonlyDay.id) return;
    }

    if (!model.output.calendar) {
        model.output.calendar = JSON.parse(JSON.stringify(model.input.calendar));
        model.output.values.fractionCount = model.input.values.fractionCount;
    }

    var data = event.target.getAttribute("data");
    if (event.target.localName=="img") {
        const increment = (data == "plus") ? +1: -1;
        updateFractions(id, increment);
    } else if ((event.target.localName=="div") && (data)) {
        updateRepairFactor(id);
    } else {
        calendarChanged(id);
    }
}

function updateFractions(id, increment) {
    const weeks = model.output.calendar.weeks;
    var val = weeks[id];
    if (val.type != config.onDay) return;
    val.fractionCnt += increment;
    if (val.fractionCnt>1) {
        let rft = getRepairFactors(val.fractionCnt);
        val.repairFactorId = rft.defaultValue;
        val.Hm = getRepairFactor(val.fractionCnt, val.repairFactorId);
    } else {
        val.repairFactorId = null;
        val.Hm = null;
    }
    for(let i=id+1; i<weeks.length; i++) {
        if (weeks[i].type != config.onDay) continue;
        weeks[i].fraction += increment;
    }
    model.output.values.fractionCount += increment;
    fillNewDose();
    fillCalendar(model.output.calendar);
}

function updateRepairFactor(id) {
    const weeks = model.output.calendar.weeks;
    var val = weeks[id];
    if (val.type != config.onDay) return;

    const callback = (x) => {
        val.repairFactorId = x;
        val.Hm = getRepairFactor(val.fractionCnt, val.repairFactorId);
        fillCalendar(model.output.calendar);
    };
    modalUtils.selectRepairFactor(val.fractionCnt, val.repairFactorId, callback);         
}

function calendarChanged(id) {
    const cal = model.output.calendar;
    var val = cal.weeks[id];
    switch (val.type) {
        case config.emptyDay: 
        case config.offDay:
            if (model.output.values.fractionCount == config.maxFractions) return;  
            val.type = config.onDay;
            val.fractionCnt = 1; 
            break;
        case config.onDay: 
            val.type = config.offDay;
            val.fractionCnt = 0; 
            break;
    }
    adjustEmptyCells();
    rebuildCalendar();
    Object.assign(
        model.output.values, 
        calcNewDose(model.output.values.fractionCount)
    );
    fillNewDose();
    fillCalendar(cal);
}

function adjustEmptyCells() {
    const outputCalendar = model.output.calendar;
    var isInside = false;
    for(let i=outputCalendar.weeks.length-1; i > model.input.values.dayOfWeek; i--) {
        let val = outputCalendar.weeks[i];
        switch (val.type) {
            case config.onDay: 
                isInside = true; 
                break;
            case config.offDay:
                if (!isInside) val.type = config.emptyDay;
                break;
            case config.emptyDay:
                if (isInside) val.type = config.offDay;
                break;
        }
    }
}


function rebuildCalendar() {
    var weeks = model.output.calendar.weeks;
    var currFraction = 1;
    var currDay = 1;
    for(let i=0; i < weeks.length; i++) {
        let val = weeks[i];
        switch (val.type) {
            case config.onDay:
                val.fraction = currFraction;
                currFraction += val.fractionCnt;
            case config.offDay:
                val.day = currDay++;
                break;
            case config.emptyDay: break;
        }
    }
    model.output.values.fractionCount = currFraction-1;
    model.output.values.treatmentDays = currDay-1;
}

function getRepairFactors(m) { 
    return (m==2) 
        ? config.repairFactorsTable2 
        : config.repairFactorsTable3;
}

function getRepairFactor(m, id) {
    var table = getRepairFactors(m).table;
    var len = table[0].length;
    var y = id % len;
    var x = (id - y) / len + 1;
    return table[x][y+1]; 
}

function getEquivalentQuantityDose(fractionCount, fraction, alphabeta) {
    return (fraction * fractionCount) * (fraction + alphabeta) / (2+alphabeta);
}

function calcNewDose(newFractionCount) {
    const input = model.input.values;
    const output = model.output.values;
    const EQD2 = getEquivalentQuantityDose(input.fractionCount, input.fraction, input.alphabeta);
    const EQD2new = getEquivalentQuantityDose(newFractionCount, input.fraction, input.alphabeta);
    const deltaT = input.fractionCount - newFractionCount;
    const EQD2T = EQD2new - deltaT * input.prolifiration;
    const doseLostPercent = 100*(1-EQD2T/EQD2);
    const doseError = 1 - solveQuadraticEquation(
        input.fraction, 
        input.alphabeta,
        -EQD2T*(2+input.alphabeta)/input.totalDose
    );
    const receivedDose = input.receivedDose;
    const remainingDose = getEquivalentQuantityDose(newFractionCount-input.fractionProceed, input.fraction, input.alphabeta);
    const doseDiff = EQD2T - EQD2;
    const totalDose = EQD2 - receivedDose - doseDiff;
    const fraction = solveQuadraticEquation(
        1, 
        input.alphabeta,
        -totalDose*(2+input.alphabeta)/(newFractionCount-input.fractionProceed)
    );
    return { 
        EQD2, EQD2new, deltaT, EQD2T, doseLostPercent, doseError, 
        receivedDose, remainingDose, doseDiff, totalDose, fraction
    };
}

function solveQuadraticEquation(a,b,c) {
    const discr = Math.sqrt(b*b - 4*a*c);
    const x1 = (-b + discr) / (2*a);
    return x1;
    //return { x1, discr };
}

function inputDataChanged(event) {
    var inputValues = getInputData();
    calcFormValues(inputValues);
    fillReadonlyFormData(inputValues);
    model.input.values = inputValues;
    model.input.calendar = calcCalendar(model.input.values);
    model.output.calendar = null;
    console.log(model);
    fillDoseChart();
    fillCalendar(model.input.calendar);
}

function fillDoseChart() {
    const printBar = (x) => `
        <div class="col d-flex flex-column-reverse">
            <div class="chart-label">${x.days} дней</div>
            <div class="chart-bar ${x.class}" style="height:${x.fraction}rem"></div>
            <div class="chart-dose">${x.fraction} Гр</div>
        </div>`;

    const remainingDays = model.input.values.fractionCount - model.input.values.fractionProceed;
    const start = Math.max(1, remainingDays - 4);
    const bars1 = Array.from({length : 9}, (x, idx) => start + idx)
                      .map(x => ({ 
                          days: x, 
                          fraction: Math.round(calcNewDose(x+model.input.values.fractionProceed).fraction*100)/100,
                          class: (x == remainingDays) ? "this-dose" : "" 
                       }));
    const bars = bars1                   
                      .filter(x=>x.fraction > 0)
                      .map(printBar)
                      .join("");

    document.getElementById("chart-content").innerHTML = `<div class="row">${bars}</div>`;
}

function fillNewDose() {
    const input = model.input.values;
    const output = model.output.values;
    const weeks = model.output.calendar.weeks;
    var dose = input.fraction;
    for(let i=0; i<weeks.length; i++) {
        if (weeks[i].type == config.onDay) {
            weeks[i].dose = dose;
        }
        if (weeks[i].fraction == input.fractionProceed) {
            dose = Math.round(output.fraction*100)/100;
        }
    } 
}

function fillCalendar(calendar) {
    const crlf = '<div class="w-100"></div>';
    
    const getTableHeader = () => config.weekDayNames
                              .map(x => `<div class="col theader">${x}</div>`)
                              .join("");

    const getPlusMinusIcon = (img) => `<img src="images/${img}.svg" data="${img}">`;
        
    const getCalendarCellOn = (id, frac, dose, tday, cl, imgs, Hm) => 
    `<div id="c${id}" class="col d-flex flex-row day-on ${cl}">
        <div class="flex-grow-1 flex-column">
           <div class="flex-grow-1 mday">${frac}</div>
           <div class="details">${dose}&nbsp;Gy  ${Hm}</div>
        </div>
        <div class="cday d-flex flex-column justify-content-between">
           <div>${tday}</div>
           ${imgs.map(getPlusMinusIcon).join("")} 
        </div>
    </div>`;                          
    
    const getCalendarCellOff = (id, tday, cl) => 
    `<div id="c${id}" class="col d-flex flex-row day-off ${cl}">
        <div class="flex-grow-1 flex-column"></div>
        <div class="cday">${tday}</div>
    </div>`;                          

    const getCalendarCellEmpty = (id) => `<div id="c${id}" class="col"></div>`;

    const getFraction = (cell) => 
           Array.from({length:cell.fractionCnt}, (x,ind) => `${cell.fraction+ind}`)
                .join("/");

    const generateIconsList = (fractionCount) => {
        var result = [];
        if (fractionCount > 1) result.push("minus");
        if (fractionCount < config.maxFractionsPerDay) result.push("plus");
        return result;
    }

    const getHm = (x) => {
        if (x.fractionCnt <= 1) return "";
        return `<div class="Hm" data="${x.Hm}"><i>H<sub>m</sub></i>=${x.Hm.toFixed(4)}</div>`;
    }

    function getCell(x, idx) {
        var line = (idx % 7 == 0) ? crlf : "";
        switch (x.type) {
          case config.onDay : return line + getCalendarCellOn(
              x.id, getFraction(x), x.dose, x.day, 
              x.class+((x.fractionCnt>1)?" multi":""), 
              generateIconsList(x.fractionCnt),
              getHm(x)); 
          case config.offDay: return line + getCalendarCellOff(x.id, x.day, x.class);
          default: return line + getCalendarCellEmpty(x.id);
        }
    };

    const html = [
        getTableHeader(),
        ...calendar.weeks.map(getCell)
    ].join("");

    document.getElementById("calendar-content").innerHTML = html;

}

function calcCalendar(inputData) {
    var disabledClass = (inputData.fractionProceed == 0) ? "" : "disabled";
    var calendar = { weeks: [] };
    var currFraction = 1;
    var currDay = 1;
    var idCounter = 0;
    for(let i=0; i < inputData.treatmentWeeks; i++) {
        let start = (i==0) ? inputData.dayOfWeek : 0;
        let end = (i==inputData.treatmentWeeks-1) ? (inputData.dayOfWeek + inputData.treatmentDays) % 7 : 5;
        let j=0;
        for(; j<start; j++) {
            calendar.weeks.push({ 
                id: idCounter++, 
                type : config.emptyDay,
                class: disabledClass 
            });
        }
        for(; j<end; j++) {
            calendar.weeks.push({ 
                id: idCounter++,
                type: config.onDay,
                fraction: currFraction++,
                fractionCnt: 1,
                day: currDay++,
                dose: inputData.fraction,
                class: disabledClass 
            });
            if (currFraction == inputData.fractionProceed+1) {
                disabledClass = "";
            }
        }
        for(; j<7; j++) {
            if (currDay < inputData.treatmentDays) {
                calendar.weeks.push({ 
                   id: idCounter++,
                   type: config.offDay,
                   day: currDay++,
                   class: disabledClass 
                });
            } else {
                calendar.weeks.push({  
                    id: idCounter++, 
                    type : config.emptyDay,
                    class: disabledClass 
                });
            }
        }
    }
    return calendar;
}


attachFormEvents();
inputDataChanged();

// document.getElementById("test-button").addEventListener("click", 
//    ()=> modalUtils.selectRepairFactor(3,38,console.log)
// );
