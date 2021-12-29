"use strict";

const modalUtils = (function() {
    var modalCallback = null;
    var selectedItem = null;


//     function getRepairFactorTable(repairFactor, selected, m) {
//         var id = 0;
//         const t = repairFactor.table;
//         const mask = repairFactor.grayMask.join("");
//         const headCell = (x) => `<th>${x}`;
//         const tableCell = (x) => `<td class="${id == selected ? 'selected':''} ${mask[id]==1?'gray':''}" data="${id++}">${x.toFixed(4)}`;
//         const skipFirst = (arr) => arr.filter((x, i) => i != 0);

//         const rowCell = (arr) => `<tr>${headCell(arr[0].toFixed(2))}</th>${skipFirst(arr).map(tableCell).join("")}</tr>`;
//         return `
// <table class="table table-bordered table-hover table-sm repair-factors">
//    <thead>
//       <tr><th class="fcol" rowspan=2>Repair halfltime (hours)</th><th colspan=${t[0].length}>Interval for <i>m</i> = ${m} fractions per day</th></tr>
//       <tr>${t[0].map(headCell).join("")}</tr>
//    </thead>
//    <tbody>${skipFirst(t).map(rowCell).join("")}<tbody>
// </table>
// <div>
//   <table class="note">
//     <tbody>
//       <tr><td><i>Note: </i><td>Shaded cells: The approximation of complete overnight repair is less precise here and this affects the precision of biological dose estimates.
//       <tr><td><i>Source:</i><td>Basic Clinical Radiobiology, Michael C. Joiner, ‎Albert J. van der Kogel - 2018, p.107, Table 9.4
//     </tbody>
//   </table>  
//  </div>`;
//     }

    function getDeltaTime(m, deltaT, fraction) {
        const deltas = [0.5, 0.75, 1.0, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8, 9, 10, 11, 12]
                      .filter(x=>x*m<=24);

        const data = deltas.map(x => ({ t: x, dose: calcMultiPerDayDose(fraction, m, x) }));
        const rowCell = (x) => `<tr class="${x.t==deltaT?'selected':'null'}" data="${x.t}"><td>${x.t.toFixed(2)}<td>${x.dose}</tr>`;
        return `
<table class="table table-bordered table-hover table-sm repair-factors">
   <thead>
      <tr><th>${config.labels.time_interval_col1}<th>${config.labels.time_interval_col2}
   </thead>
   <tbody>${data.map(rowCell).join("")}<tbody>
</table>
`;
    }

    function modalTableClick(ev) {
        if (!ev.target) return;
        var deltaT = ev.target.parentElement.getAttribute("data");
        if (!deltaT) return;
        deltaT = parseFloat(deltaT, 10);
        if (selectedItem != deltaT) modalCallback(deltaT);
        $("#myModal").modal("hide");
    }

    function showModalTable(content) {
        const html = `
<div id="myModal" class="modal" tabindex="-1" role="dialog">
   <div class="modal-dialog" role="document">
      <div class="modal-content">
         <div class="modal-header">
            <h5 class="modal-title">${config.labels.time_interval_header}</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
         </div>
      <div class="modal-body">
          ${content}
      </div>
      <div class="modal-footer">
         <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>`;
        const m = document.getElementById("modal-placeholder");
        m.innerHTML = html;
        m.addEventListener("click", modalTableClick);
        $("#myModal").modal("show");
    }

    function selectRepairFactor(m, deltaT, fraction, callback) {
        // const repairTable = (m == 2)
        //     ? config.repairFactorsTable2
        //     : config.repairFactorsTable3;

        modalCallback = callback;
        selectedItem = deltaT;
        //var content = getRepairFactorTable(repairTable, selected, m);
        var content = getDeltaTime(m, deltaT, fraction)
        showModalTable(content);
    }

    return {
        selectRepairFactor: selectRepairFactor
    }
})();

