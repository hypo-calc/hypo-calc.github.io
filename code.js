"use strict";

var model = {
    input : { values : {}, calendar: null },
    output: { values : {}, calendar: null }
};

function getInputData() {
    var data = {};
    config.formEditableValues.forEach(
        x => data[x] = parseFloat(document.getElementById(x).value)
    );
    data.useProlif = document.getElementById("useProlif").checked;
    var prolifElem = document.getElementById("prolif");
    prolifElem.disabled = !data.useProlif;
    if (!data.useProlif) prolifElem.value = "";

    var validatedCount =
       validateData("fraction", (data.fraction > 0) && (data.fraction < 100)) +
       validateData("fractionCount", (data.fractionCount > 0) && (data.fractionCount < 100)) +
       validateData("fractionProceed", (data.fractionProceed >= 0) && (data.fractionProceed < data.fractionCount)) +
       validateData("alphabeta", (data.alphabeta >= 0) && (data.alphabeta < 100)) +
       validateData("recoveryHalftime", (data.recoveryHalftime > 0) && (data.recoveryHalftime < 100));

    validateData("prolif", (!data.useProlif) || ((data.prolif > 0) && (data.prolif < 100)));
    setEnabledProlif(data);

    setElementVisible("LQ_alert_lbl", data.fraction > 8);

    if (validatedCount != 5) return false;
    return data;
}

function validateData(id, result) {
    let elem = document.getElementById(id);
    if (result) elem.classList.remove("error")
    else elem.classList.add("error");
    return result ? 1:0;
}

function setEnabledProlif(data) {
    calcFormValues(data);
    let isEnabled = data.treatmentDays > 21;
    var useProlif = document.getElementById("useProlif");
    useProlif.disabled = !isEnabled;
    if (!isEnabled) useProlif.checked = false;
    if (!isEnabled) {
        var prolifElem = document.getElementById("prolif");
        prolifElem.disabled = true;
        prolifElem.value = "";
    }
}

function calcFormValues(data) {
    const workingDaysInWeek = 5;
    const offDaysInWeek = 2;
    const weekAligned = data.fractionCount + data.dayOfWeek;    
    const rem = weekAligned % workingDaysInWeek;
    data.treatmentWeeks = (weekAligned - rem) / workingDaysInWeek + (rem > 0 ? 1:0);
    data.offDays = (data.treatmentWeeks - 1) * offDaysInWeek;
    if (data.dayOfWeek == 5) data.offDays--;
    data.treatmentDays = data.fractionCount + data.offDays;
    data.factTreatmentDays = data.treatmentDays;
    data.factOffDays = 0;
}

function calcDataValues(data) {
    data.totalDose = data.fractionCount * data.fraction;
    data.EQD2 = getEquivalentQuantityDose(data.fractionCount, data.fraction, data.alphabeta);
    data.receivedDose = getEquivalentQuantityDose(data.fractionProceed, data.fraction, data.alphabeta);
    data.remainingDose = getEquivalentQuantityDose(data.fractionCount - data.fractionProceed, data.fraction, data.alphabeta);
    data.BED = data.totalDose * (1+ data.fraction/data.alphabeta);

    if ((data.useProlif) && (data.prolif > 0)) {
        data.EQD2prolif = data.EQD2 - ((data.factTreatmentDays - data.treatmentDays) * data.prolif);
    } else {
        data.EQD2prolif = "";
    }
}

function fillReadonlyFormData(data) {
    config.formReadonlyValues.forEach(
        x => document.getElementById(x).value = data[x]!="" ? (Math.round(data[x] * 1000) / 1000) : ""
    );
}

function cleanAllCalculatedData() {
    config.formReadonlyValues.forEach(
        x => document.getElementById(x).value = ""
    );
}

function attachFormEvents() {
    config.formEditableValues.forEach(
        x => document.getElementById(x).addEventListener("change", inputDataChanged)
    );
    document.getElementById("btnRu").addEventListener("click", setLanguageRu, false);
    document.getElementById("btnEn").addEventListener("click", setLanguageEn, false);
    var content = document.getElementById("calendar-content");
    content.addEventListener("click", calendarClick, false);
    var addWeek = document.getElementById("add_week_lbl");
    addWeek.addEventListener("click", addWeekClick, false);

}

function addWeekClick(event) {
    const fillCalendarWithEmptyWeek = (c) => {
        let idCounter = c.length;
        for(let i=1; i<=7; i++) c.push({  
            id: idCounter++, 
            type : config.emptyDay,
            class: "" 
        });
    }

    let cal = model.input.calendar;
    fillCalendarWithEmptyWeek(cal.weeks);
    if (model.output.calendar) {
        cal = model.output.calendar;
        fillCalendarWithEmptyWeek(cal.weeks);
    }
    fillCalendar(cal);
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
        ["fractionCount", "dayOfWeek", "fractionProceed"].forEach(
            x => document.getElementById(x).disabled = true
        );
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
        //let rft = getRepairFactors(val.fractionCnt);
        //val.repairFactorId = rft.defaultValue;
        val.deltaT = config.defaultMultifractionPeriod[val.fractionCnt];
        //val.Hm = getRepairFactor(val.fractionCnt, val.Ht);
    } else {
        val.deltaT = null;
        //val.Hm = null;
    }
    for(let i=id+1; i<weeks.length; i++) {
        if (weeks[i].type != config.onDay) continue;
        weeks[i].fraction += increment;
    }
    model.output.values.fractionCount += increment;
    calcAndFillCalendar(model.output.calendar);
}

function updateRepairFactor(id) {
    const weeks = model.output.calendar.weeks;
    var val = weeks[id];
    if (val.type != config.onDay) return;

    const callback = (x) => {
        val.deltaT = x;
        config.defaultMultifractionPeriod[val.fractionCnt] = x;
        //val.Hm = getRepairFactor(val.fractionCnt, model.input.values.recoveryHalftime, val.deltaT);
        calcAndFillCalendar(model.output.calendar);
    };
    modalUtils.selectRepairFactor(val.fractionCnt, val.deltaT, model.output.values.fraction, callback);         
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
    calcAndFillCalendar(cal);
}

function calcAndFillCalendar(cal) {

    Object.assign(
        model.output.values, 
        calcNewDose(model.output.values.fractionCount)
    );
    fillNewDose();
    fillCalendar(cal);

    let inputData = getInputData();
    calcFormValues(inputData);
    inputData.factTreatmentDays = model.output.values.treatmentDays;
    inputData.factOffDays = model.output.values.offDays - model.input.values.offDays;
    calcDataValues(inputData);
    fillReadonlyFormData(inputData)
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
    var offDays = 0;
    for(let i=0; i < weeks.length; i++) {
        let val = weeks[i];
        switch (val.type) {
            case config.onDay:
                val.fraction = currFraction;
                currFraction += val.fractionCnt;
                val.day = currDay++;
                break;
            case config.offDay:
                val.day = currDay++;
                offDays++;
                break;
            case config.emptyDay: break;
        }
    }
    model.output.values.fractionCount = currFraction-1;
    model.output.values.treatmentDays = currDay-1;
    model.output.values.offDays = offDays;
}

function getRepairFactor(m, ht, Δt) {
    const μ = Math.log(2) / ht;
    const φ = Math.exp(-μ * Δt);
    const Hm = (2/m) * (φ/(1-φ)) * (m - (1-Math.pow(φ,m))/(1-φ));
    return Hm;
}

function getEquivalentQuantityDose(fractionCount, fraction, alphabeta) {
    return (fraction * fractionCount) * (fraction + alphabeta) / (2+alphabeta);
}

function calcNewDose(newFractionCount) {
    const input = model.input.values;
    const output = model.output.values;
    const EQD2 = getEquivalentQuantityDose(input.fractionCount, input.fraction, input.alphabeta);
    const EQD2new = getEquivalentQuantityDose(newFractionCount, input.fraction, input.alphabeta);

    //const doseLostPercent = 100*(1-EQD2T/EQD2);
    // const doseError = 1 - solveQuadraticEquation(
    //     input.fraction, 
    //     input.alphabeta,
    //     -EQD2T*(2+input.alphabeta)/input.totalDose
    // );
    //const receivedDose = input.receivedDose;

    let remainingDose = input.remainingDose;
    if (input.useProlif && (input.prolif>0)) {
        const deltaT = (output.treatmentDays || input.treatmentDays) - input.treatmentDays;
        remainingDose += deltaT * input.prolif;
    }

    const fraction = solveQuadraticEquation(
        1, 
        input.alphabeta,
        -remainingDose*(2+input.alphabeta)/(newFractionCount-input.fractionProceed)
    );
    return {
        EQD2, EQD2new, /*deltaT, EQD2T, doseLostPercent, doseError, 
        receivedDose, remainingDose, doseDiff,*/ totalDose, fraction
    };
}

function calcMultiPerDayDose(fraction, fractionCnt, deltaT) {
    const input = model.input.values;
    const EQD2 = getEquivalentQuantityDose(fractionCnt, fraction, input.alphabeta);
    const Hm = getRepairFactor(fractionCnt, input.recoveryHalftime, deltaT);
    const dose = solveQuadraticEquation(
        1+Hm,
        input.alphabeta,
        -EQD2*(2+input.alphabeta) / fractionCnt
    );
    return (Math.round(dose*100)/100).toFixed(2);
}

function solveQuadraticEquation(a,b,c) {
    const discr = Math.sqrt(b*b - 4*a*c);
    const x1 = (-b + discr) / (2*a);
    return x1;
    //return { x1, discr };
}

function inputDataChanged(event) {
    var inputValues = getInputData();
    if (!inputValues) {
        cleanAllCalculatedData();
        return;
    }

    calcFormValues(inputValues);
    calcDataValues(inputValues);

    fillReadonlyFormData(inputValues);

    model.input.values = inputValues;
    if (model.output.calendar) {
        rebuildCalendar();
        calcAndFillCalendar(model.output.calendar);
    } else {
        model.input.calendar = calcCalendar(model.input.values);
        model.output.calendar = null;
        fillCalendar(model.input.calendar);
    }
}

function setElementVisible(elem_id, value) {
    document.getElementById(elem_id).style.display = value? "block" : "none";
}


function fillNewDose() {
    const input = model.input.values;
    const output = model.output.values;
    const weeks = model.output.calendar.weeks;
    var dose = (input.fractionProceed==0) ? output.fraction : input.fraction;
    dose = Math.round(dose*100)/100;
    for(let i=0; i<weeks.length; i++) {
        if (weeks[i].type == config.onDay) {
            if (weeks[i].fractionCnt==1) {
                weeks[i].dose = dose;
            } else {
                weeks[i].dose = calcMultiPerDayDose(dose, weeks[i].fractionCnt, weeks[i].deltaT);
            }
        }
        if (weeks[i].fraction == input.fractionProceed) {
            dose = Math.round(output.fraction*100)/100;
        }
    } 
}

function fillCalendar(calendar) {
    const crlf = '<div class="w-100"></div>';
    
    const getTableHeader = () => config.labels.weekDayNames
                              .map(x => `<div class="col theader">${x}</div>`)
                              .join("");

    const getPlusMinusIcon = (img) => `<img src="images/${img}.svg" data="${img}">`;
        
    const getCalendarCellOn = (id, frac, dose, tday, cl, imgs, deltaT) => 
    `<div id="c${id}" class="col d-flex flex-row day-on ${cl}">
        <div class="flex-grow-1 flex-column">
           <div class="flex-grow-1 mday">${frac}</div>
           <div class="details">${dose}&nbsp;${config.labels.gray}  ${deltaT}</div>
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

    const getDeltaT = (x) => {
        if (x.fractionCnt <= 1) return "";
        return `<div class="Hm" data="${x.deltaT}"><i>Δt</i>=${x.deltaT}${config.labels.hour}</div>`;
    }

    function getCell(x, idx) {
        var line = (idx % 7 == 0) ? crlf : "";
        switch (x.type) {
          case config.onDay : return line + getCalendarCellOn(
              x.id, getFraction(x), x.dose, x.day, 
              x.class+((x.fractionCnt>1)?" multi":""), 
              generateIconsList(x.fractionCnt),
              getDeltaT(x)); 
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
        if (end <= start) end = start+1;
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

function setLanguageRu() { setLanguage(config.labels_ru); }
function setLanguageEn() { setLanguage(config.labels_en); }

function setLanguage(labels) {
    if (config.labels == labels) return;
    config.labels = labels;
    for (let prop in labels) {
        var elem = document.getElementById(prop);
        if (!elem) continue;
        elem.innerHTML = labels[prop];
    }
    document.title = labels.main_title;

    var selector = document.getElementById("dayOfWeek");
    selector.options.length=0
    for(var i=0; i<labels.weekDayNames.length-1; i++) {
        selector.options[i] = new Option(labels.weekDayNames[i], i, i==0, false);
    }

    var hint = document.getElementById("prolif_lbl");
    hint.title = labels.prolif_lbl_hint;
    hint = document.getElementById("prolif");
    hint.title = labels.prolif_lbl_hint;
}

function createEmptyCalendar(weeksCnt) {
    var weeks = new Array();
    for(let i=0; i<7*weeksCnt; i++) weeks.push({ id: i, type : config.emptyDay, class: "" });
    fillCalendar({ weeks });
}

setLanguageRu();
attachFormEvents();
inputDataChanged();
createEmptyCalendar(6);

