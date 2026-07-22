import React, { useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import { Download, FileSpreadsheet, Upload, XCircle } from 'lucide-react';
import { Cliente, Insumo, Transaccion, Turno } from '../types';

export interface ExcelClientRow {
  nombre: string;
  telefono: string;
  patente: string;
  modelo: string;
  rowNumber: number;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

interface ExcelIntegrationProps {
  clientes: Cliente[];
  turnos: Turno[];
  transacciones: Transaccion[];
  insumos: Insumo[];
  onImportClients: (rows: ExcelClientRow[]) => Promise<ImportResult>;
}

const headerFill = '334155';
const accentFill = '2563EB';
const softFill = 'E2E8F0';
const moneyFormat = '$#,##0.00';

function normalizeHeader(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function downloadBuffer(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function styleWorksheet(sheet: ExcelJS.Worksheet, widths: number[]) {
  sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  sheet.properties.defaultRowHeight = 20;
  sheet.columns.forEach((column, index) => {
    column.width = Math.min(widths[index] ?? 16, 32);
  });
  const header = sheet.getRow(1);
  header.height = 26;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${headerFill}` } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  header.eachCell((cell) => {
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } };
  });
  if (sheet.rowCount > 1) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } };
  }
}

export default function ExcelIntegration({ clientes, turnos, transacciones, insumos, onImportClients }: ExcelIntegrationProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ExcelClientRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState('');

  const exportWorkbook = async () => {
    setIsWorking(true);
    setStatus('Preparando el archivo…');
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Lavadero';
      workbook.created = new Date();
      workbook.modified = new Date();
      const resumen = workbook.addWorksheet('Resumen', { properties: { tabColor: { argb: `FF${accentFill}` } } });

      const clientesSheet = workbook.addWorksheet('Clientes');
      clientesSheet.addRow(['Nombre', 'Teléfono', 'Patente', 'Modelo', 'Visitas']);
      clientes.forEach((cliente) => clientesSheet.addRow([
        cliente.nombre, cliente.telefono, cliente.vehiculoPatente, cliente.vehiculoModelo, cliente.visitas,
      ]));
      styleWorksheet(clientesSheet, [28, 18, 14, 28, 12]);
      clientesSheet.getColumn(5).numFmt = '#,##0';

      const turnosSheet = workbook.addWorksheet('Turnos');
      turnosSheet.addRow(['ID', 'Fecha', 'Cliente', 'Patente', 'Servicio', 'Responsable', 'Estado', 'Importe']);
      turnos.forEach((turno) => turnosSheet.addRow([
        turno.id,
        new Date(turno.fechaCreacion),
        turno.clienteNombre,
        turno.vehiculoPatente,
        turno.servicioNombre,
        turno.lavadorAsignado,
        turno.estado.replace('_', ' '),
        turno.precio,
      ]));
      styleWorksheet(turnosSheet, [14, 18, 26, 14, 32, 20, 16, 16]);
      turnosSheet.getColumn(2).numFmt = 'yyyy-mm-dd hh:mm';
      turnosSheet.getColumn(8).numFmt = moneyFormat;

      const cajaSheet = workbook.addWorksheet('Caja');
      cajaSheet.addRow(['ID', 'Tipo', 'Monto', 'Concepto', 'Origen', 'Medio de pago', 'Turno', 'Fecha']);
      transacciones.forEach((tx) => cajaSheet.addRow([
        tx.id, tx.tipo, tx.monto, tx.concepto, tx.origen, tx.metodoPago ?? '', tx.turnoId ?? '', new Date(tx.fecha),
      ]));
      styleWorksheet(cajaSheet, [14, 14, 16, 42, 18, 18, 12, 20]);
      cajaSheet.getColumn(3).numFmt = moneyFormat;
      cajaSheet.getColumn(8).numFmt = 'yyyy-mm-dd hh:mm';

      const inventarioSheet = workbook.addWorksheet('Inventario');
      inventarioSheet.addRow(['ID', 'Insumo', 'Stock actual', 'Stock mínimo', 'Unidad', 'Costo unitario', 'Estado']);
      insumos.forEach((item) => inventarioSheet.addRow([
        item.id,
        item.nombre,
        item.stockActual,
        item.stockMinimo,
        item.unidad,
        item.precioCosto,
        item.stockActual <= item.stockMinimo ? 'REVISAR' : 'OK',
      ]));
      styleWorksheet(inventarioSheet, [14, 30, 15, 15, 12, 18, 14]);
      inventarioSheet.getColumn(6).numFmt = moneyFormat;

      resumen.views = [{ showGridLines: false }];
      resumen.mergeCells('A1:D1');
      resumen.getCell('A1').value = 'Resumen operativo del lavadero';
      resumen.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
      resumen.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${accentFill}` } };
      resumen.getCell('A1').alignment = { vertical: 'middle' };
      resumen.getRow(1).height = 34;
      resumen.addRow([]);
      resumen.addRow(['Indicador', 'Valor']);
      const clientesEnd = Math.max(clientes.length + 1, 2);
      const turnosEnd = Math.max(turnos.length + 1, 2);
      const cajaEnd = Math.max(transacciones.length + 1, 2);
      const inventarioEnd = Math.max(insumos.length + 1, 2);
      resumen.addRow(['Clientes', { formula: `COUNTA('Clientes'!A2:A${clientesEnd})` }]);
      resumen.addRow(['Turnos', { formula: `COUNTA('Turnos'!A2:A${turnosEnd})` }]);
      resumen.addRow(['Ingresos', { formula: `SUMIF('Caja'!B2:B${cajaEnd},"INGRESO",'Caja'!C2:C${cajaEnd})` }]);
      resumen.addRow(['Egresos', { formula: `SUMIF('Caja'!B2:B${cajaEnd},"EGRESO",'Caja'!C2:C${cajaEnd})` }]);
      resumen.addRow(['Stock para revisar', { formula: `COUNTIF('Inventario'!G2:G${inventarioEnd},"REVISAR")` }]);
      resumen.addRow(['Cobros en efectivo', { formula: `SUMIFS('Caja'!C2:C${cajaEnd},'Caja'!B2:B${cajaEnd},"INGRESO",'Caja'!F2:F${cajaEnd},"EFECTIVO")` }]);
      resumen.addRow(['Cobros por transferencia', { formula: `SUMIFS('Caja'!C2:C${cajaEnd},'Caja'!B2:B${cajaEnd},"INGRESO",'Caja'!F2:F${cajaEnd},"TRANSFERENCIA")` }]);
      resumen.addRow(['Cobros con débito', { formula: `SUMIFS('Caja'!C2:C${cajaEnd},'Caja'!B2:B${cajaEnd},"INGRESO",'Caja'!F2:F${cajaEnd},"DEBITO")` }]);
      resumen.addRow(['Cobros con crédito', { formula: `SUMIFS('Caja'!C2:C${cajaEnd},'Caja'!B2:B${cajaEnd},"INGRESO",'Caja'!F2:F${cajaEnd},"CREDITO")` }]);
      resumen.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      resumen.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${headerFill}` } };
      resumen.getColumn(1).width = 28;
      resumen.getColumn(2).width = 20;
      resumen.getColumn(2).numFmt = '#,##0';
      resumen.getCell('B6').numFmt = moneyFormat;
      resumen.getCell('B7').numFmt = moneyFormat;
      for (let row = 9; row <= 12; row += 1) resumen.getCell(`B${row}`).numFmt = moneyFormat;
      for (let row = 4; row <= 12; row += 1) {
        resumen.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${softFill}` } };
        resumen.getCell(`A${row}`).font = { bold: true, color: { argb: 'FF1E293B' } };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      downloadBuffer(buffer, `Lavadero_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setStatus('Excel exportado correctamente.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo generar el Excel.');
    } finally {
      setIsWorking(false);
    }
  };

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Clientes');
    sheet.addRow(['Nombre', 'Teléfono', 'Patente', 'Modelo']);
    sheet.addRow(['Ejemplo Cliente', '+5490000000000', 'AB123CD', 'Toyota Corolla gris']);
    styleWorksheet(sheet, [28, 20, 16, 30]);
    sheet.getRow(2).font = { italic: true, color: { argb: 'FF64748B' } };
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBuffer(buffer, 'Plantilla_clientes_lavadero.xlsx');
  };

  const handleFile = async (file: File) => {
    setStatus('Leyendo Excel…');
    setPreview([]);
    setValidationErrors([]);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera el límite de 5 MB.');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet('Clientes') ?? workbook.worksheets[0];
      if (!sheet) throw new Error('El libro no contiene una hoja para importar.');
      const headers = new Map<string, number>();
      sheet.getRow(1).eachCell((cell, columnNumber) => headers.set(normalizeHeader(cell.value), columnNumber));
      const requiredHeaders = ['nombre', 'patente'];
      const missing = requiredHeaders.filter((header) => !headers.has(header));
      if (missing.length) throw new Error(`Faltan columnas obligatorias: ${missing.join(', ')}.`);
      const rows: ExcelClientRow[] = [];
      const errors: string[] = [];
      const lastRow = Math.min(sheet.rowCount, 501);
      for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const read = (header: string) => {
          const columnNumber = headers.get(header);
          return columnNumber ? String(row.getCell(columnNumber).text ?? '').trim() : '';
        };
        const nombre = read('nombre');
        const patente = read('patente').toUpperCase().replace(/\s/g, '');
        if (!nombre && !patente) continue;
        if (nombre.length < 2) {
          errors.push(`Fila ${rowNumber}: nombre inválido.`);
          continue;
        }
        if (!/^[A-Z0-9]{6,9}$/.test(patente)) {
          errors.push(`Fila ${rowNumber}: patente inválida.`);
          continue;
        }
        rows.push({
          nombre,
          telefono: read('telefono'),
          patente,
          modelo: read('modelo') || 'Vehículo sin modelo',
          rowNumber,
        });
      }
      setPreview(rows);
      setValidationErrors(errors);
      setStatus(`${rows.length} filas válidas y ${errors.length} observaciones.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo leer el Excel.');
    }
  };

  const confirmImport = async () => {
    if (!preview.length || isWorking) return;
    setIsWorking(true);
    setStatus('Importando clientes…');
    try {
      const result = await onImportClients(preview);
      setStatus(`${result.created} creados, ${result.skipped} omitidos y ${result.errors.length} errores.`);
      setValidationErrors(result.errors);
      setPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <section className="space-y-5 animate-fade-in" aria-labelledby="excel-title">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Intercambio de datos</p>
        <h2 id="excel-title" className="mt-1 text-3xl font-black text-white">Excel</h2>
        <p className="mt-1 text-sm text-slate-300">Exportá la operación completa o importá clientes con una plantilla controlada.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel rounded-xl p-5">
          <FileSpreadsheet className="h-7 w-7 text-emerald-300" />
          <h3 className="mt-4 text-lg font-extrabold text-white">Exportar operación</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">Genera un `.xlsx` con resumen, clientes, turnos, caja e inventario, listo para filtrar y analizar.</p>
          <button type="button" onClick={exportWorkbook} disabled={isWorking} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-emerald-950 disabled:opacity-50">
            <Download className="h-4 w-4" /> Descargar Excel
          </button>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <Upload className="h-7 w-7 text-cyan-300" />
          <h3 className="mt-4 text-lg font-extrabold text-white">Importar clientes</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">Usá la plantilla para validar nombre, teléfono, patente y modelo antes de guardar.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={downloadTemplate} className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200">Descargar plantilla</button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="min-h-11 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-black text-cyan-950">Seleccionar Excel</button>
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])} />
        </div>
      </div>

      {status && <p role="status" className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-slate-200">{status}</p>}

      {preview.length > 0 && (
        <div className="glass-panel overflow-hidden rounded-xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <h3 className="font-extrabold text-white">Vista previa</h3>
              <p className="text-xs text-slate-400">Se importarán {preview.length} filas válidas.</p>
            </div>
            <button type="button" onClick={confirmImport} disabled={isWorking} className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-black text-white disabled:opacity-50">Confirmar importación</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-900/60 text-xs uppercase text-slate-400"><tr><th className="p-3">Fila</th><th className="p-3">Nombre</th><th className="p-3">Teléfono</th><th className="p-3">Patente</th><th className="p-3">Modelo</th></tr></thead>
              <tbody className="divide-y divide-white/5">{preview.slice(0, 25).map((row) => <tr key={`${row.rowNumber}-${row.patente}`}><td className="p-3 text-slate-500">{row.rowNumber}</td><td className="p-3 font-bold text-white">{row.nombre}</td><td className="p-3 text-slate-300">{row.telefono || '—'}</td><td className="p-3 font-mono text-cyan-300">{row.patente}</td><td className="p-3 text-slate-300">{row.modelo}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-amber-200"><XCircle className="h-4 w-4" /> Observaciones</h3>
          <ul className="mt-2 space-y-1 text-xs text-amber-100/80">{validationErrors.slice(0, 20).map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
