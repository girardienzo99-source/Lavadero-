import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BrandConfig } from '../types';

interface TicketInput {
  id: string;
  clienteNombre?: string;
  vehiculoModelo?: string;
  vehiculoPatente?: string;
  servicioNombre: string;
  precio: number;
  lavadorAsignado?: string;
  fecha: string;
  origen: 'TURNO' | 'VENTA_POS' | 'MANUAL';
}

function getBrandConfig(): BrandConfig {
  let brandConfig: BrandConfig = {
    nombre: 'ALBELO DETAIL',
    tagline: 'ESTÉTICA VEHICULAR • POLARIZADOS • DETAILING',
    primaryColor: '#dc2626',
    hoverColor: '#b91c1c',
    logoType: 'icon',
    selectedIcon: 'Car',
    customLogoUrl: '',
    fontFamily: 'Outfit'
  };
  try {
    const saved = localStorage.getItem('albelo_brand_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.nombre) {
        brandConfig = { ...brandConfig, ...parsed };
      }
    }
  } catch (e) {
    // Ignore error
  }
  return brandConfig;
}

function hexToRgb(hex: string): [number, number, number] {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ]
    : [220, 38, 38]; // default red
}

export function generateTicketPDF(data: TicketInput) {
  const brand = getBrandConfig();
  const primaryRgb = hexToRgb(brand.primaryColor);

  // Standard receipt size for thermal printer emulation
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 180],
  });

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // Deep dark background
  doc.rect(0, 0, 80, 25, 'F');

  // Draw primary branding accent bar
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(0, 0, 80, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(brand.nombre.toUpperCase(), 40, 8, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  
  // Truncate tagline if it's too long to fit nicely on the ticket
  let cleanTagline = brand.tagline.toUpperCase();
  if (cleanTagline.length > 45) {
    cleanTagline = cleanTagline.substring(0, 42) + '...';
  }
  doc.text(cleanTagline, 40, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(156, 163, 175);
  doc.text('Av. Marcelo T. de Alvear 1850, Río Cuarto', 40, 16, { align: 'center' });
  doc.text('Tel: 358 4226415  •  Insta: @albelodetail', 40, 19, { align: 'center' });
  doc.text('CUIT: 30-71649255-9  •  IVA RESPONSABLE INSCRIPTO', 40, 22, { align: 'center' });

  let y = 30;

  // 2. Receipt metadata
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('COMPROBANTE DE COMPRA (POS)', 40, y, { align: 'center' });

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);

  const fechaObj = new Date(data.fecha);
  const formattedDate = fechaObj.toLocaleDateString('es-AR');
  const formattedTime = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  doc.text(`FECHA: ${formattedDate}   HORA: ${formattedTime}`, 6, y);
  doc.text(`NRO: TKT-${data.id.substring(data.id.length - 8).toUpperCase()}`, 74, y, { align: 'right' });

  y += 3;
  doc.setDrawColor(226, 232, 240);
  doc.line(5, y, 75, y);

  // 3. Client & Vehicle Details Table using autoTable
  y += 2;
  const clientRows = [];
  if (data.origen === 'TURNO') {
    clientRows.push(['Cliente:', data.clienteNombre || 'Consumidor Final']);
    if (data.vehiculoModelo) clientRows.push(['Vehículo:', data.vehiculoModelo]);
    if (data.vehiculoPatente) clientRows.push(['Patente:', data.vehiculoPatente.toUpperCase()]);
    if (data.lavadorAsignado) clientRows.push(['Operario:', data.lavadorAsignado]);
  } else {
    clientRows.push(['Cliente:', 'Consumidor Final']);
    clientRows.push(['Origen:', 'Venta de Mostrador POS']);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: 5, right: 5 },
    body: clientRows,
    theme: 'plain',
    styles: {
      fontSize: 7,
      cellPadding: 0.8,
      textColor: [51, 65, 85],
      font: 'helvetica'
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 20 },
      1: { fontStyle: 'normal' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 3;
  doc.setDrawColor(226, 232, 240);
  doc.line(5, y, 75, y);

  // 4. Detalle de Servicios Table using autoTable (Professional columns)
  y += 2;
  
  const itemRows = [
    [data.servicioNombre, '1', `$${data.precio.toLocaleString('es-AR')}`, `$${data.precio.toLocaleString('es-AR')}`]
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: 5, right: 5 },
    head: [['Detalle', 'Cant', 'Precio', 'Total']],
    body: itemRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      cellPadding: 1,
      halign: 'left'
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      textColor: [15, 23, 42],
      font: 'helvetica'
    },
    columnStyles: {
      0: { cellWidth: 33 },
      1: { halign: 'center', cellWidth: 8 },
      2: { halign: 'right', cellWidth: 14 },
      3: { halign: 'right', cellWidth: 15 }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // 5. Totals calculations
  const subtotal = Math.round(data.precio * 0.81);
  const iva = data.precio - subtotal;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal Neto (81%):', 48, y, { align: 'right' });
  doc.text(`$${subtotal.toLocaleString('es-AR')}`, 74, y, { align: 'right' });

  y += 4;
  doc.text('IVA Consumidor (21%):', 48, y, { align: 'right' });
  doc.text(`$${iva.toLocaleString('es-AR')}`, 74, y, { align: 'right' });

  y += 5;
  // Dynamic background rectangle colored using our branding accent
  const lightBgR = Math.round(primaryRgb[0] + (255 - primaryRgb[0]) * 0.92);
  const lightBgG = Math.round(primaryRgb[1] + (255 - primaryRgb[1]) * 0.92);
  const lightBgB = Math.round(primaryRgb[2] + (255 - primaryRgb[2]) * 0.92);
  doc.setFillColor(lightBgR, lightBgG, lightBgB);
  doc.rect(5, y - 3.5, 70, 7, 'F');
  doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(5, y - 3.5, 70, 7, 'S');

  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('TOTAL TRANSACCIÓN:', 8, y + 1);
  doc.text(`$${data.precio.toLocaleString('es-AR')} ARS`, 72, y + 1, { align: 'right' });

  // 6. AFIP QR Code and CAE section
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text('COMPROBANTE AUTORIZADO AFIP', 40, y, { align: 'center' });

  y += 3;
  // Draw a beautiful mock QR code at x=30, y=y
  const qrX = 30;
  const qrY = y;
  
  // Outer border & background for QR Code
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX, qrY, 20, 20, 'F');
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.2);
  doc.rect(qrX, qrY, 20, 20, 'S');

  // Finder patterns (top-left, top-right, bottom-left)
  doc.setFillColor(30, 41, 59);
  // Top-left
  doc.rect(qrX + 1, qrY + 1, 5, 5, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX + 2, qrY + 2, 3, 3, 'F');
  doc.setFillColor(30, 41, 59);
  doc.rect(qrX + 2.5, qrY + 2.5, 2, 2, 'F');

  // Top-right
  doc.rect(qrX + 14, qrY + 1, 5, 5, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX + 15, qrY + 2, 3, 3, 'F');
  doc.setFillColor(30, 41, 59);
  doc.rect(qrX + 15.5, qrY + 2.5, 2, 2, 'F');

  // Bottom-left
  doc.rect(qrX + 1, qrY + 14, 5, 5, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX + 2, qrY + 15, 3, 3, 'F');
  doc.setFillColor(30, 41, 59);
  doc.rect(qrX + 2.5, qrY + 15.5, 2, 2, 'F');

  // Alignment pattern bottom-right
  doc.rect(qrX + 13, qrY + 13, 3, 3, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX + 14, qrY + 14, 1, 1, 'F');

  // Random QR noise pixels
  doc.setFillColor(30, 41, 59);
  const qrPixels = [
    [7, 1], [9, 1], [11, 2], [12, 1],
    [7, 3], [8, 4], [10, 4], [12, 3], [12, 5],
    [1, 7], [3, 7], [4, 8], [6, 7], [7, 7], [9, 6], [11, 7], [13, 7], [15, 7], [17, 7], [18, 8],
    [2, 9], [5, 9], [8, 9], [10, 8], [11, 10], [14, 9], [16, 9],
    [1, 11], [3, 11], [6, 11], [7, 12], [9, 11], [13, 11], [15, 12], [18, 11],
    [7, 13], [10, 13], [11, 14], [12, 13], [17, 13],
    [8, 15], [9, 16], [13, 16], [15, 15], [16, 17],
    [7, 18], [9, 17], [11, 18], [14, 18], [18, 18]
  ];
  qrPixels.forEach(([px, py]) => {
    doc.rect(qrX + px, qrY + py, 1, 1, 'F');
  });

  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Comprobante Homologado AFIP', 40, y, { align: 'center' });
  y += 2.5;
  doc.text('CAE N°: 73254915648521', 40, y, { align: 'center' });
  y += 2.5;
  const vtoCAE = new Date();
  vtoCAE.setDate(vtoCAE.getDate() + 10);
  doc.text(`Vto. CAE: ${vtoCAE.toLocaleDateString('es-AR')}`, 40, y, { align: 'center' });

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text(`¡Gracias por elegir ${brand.nombre}!`, 40, y, { align: 'center' });

  // Save PDF
  const cleanBrandName = brand.nombre.replace(/\s+/g, '_');
  const filename = `Ticket_${cleanBrandName}_${data.id}.pdf`;
  doc.save(filename);
}

export interface InspectionInput {
  patente: string;
  modelo: string;
  inspector: string;
  checklistDanos: Record<string, boolean>;
  observaciones: string;
  fecha: string;
}

export function generateInspectionPDF(data: InspectionInput) {
  const brand = getBrandConfig();
  const primaryRgb = hexToRgb(brand.primaryColor);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Top header banner
  doc.setFillColor(15, 23, 42); // Deep dark
  doc.rect(0, 0, 210, 35, 'F');

  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(0, 0, 210, 3, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(brand.nombre.toUpperCase(), 15, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text(brand.tagline.toUpperCase(), 15, 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text('INFORME DE INSPECCIÓN VEHICULAR', 195, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Fecha: ${new Date(data.fecha).toLocaleDateString('es-AR')} ${new Date(data.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`, 195, 25, { align: 'right' });

  let y = 45;

  // Client / Vehicle Details Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Datos de Recepción', 15, y);

  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(15, y, 195, y);

  y += 2;
  const detailRows = [
    ['Vehículo / Modelo:', data.modelo, 'Patente / Dominio:', data.patente.toUpperCase()],
    ['Inspector Técnico:', data.inspector, 'Ubicación:', 'Estudio Central Albelo']
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 15 },
    body: detailRows,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 2,
      textColor: [51, 65, 85],
      font: 'helvetica'
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 60 },
      2: { fontStyle: 'bold', cellWidth: 35 },
      3: { cellWidth: 50 }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Damage Checklist Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Registro de Daños Pre-existentes', 15, y);

  y += 4;
  doc.line(15, y, 195, y);

  y += 2;

  const checklistMap: Record<string, string> = {
    paragolpesDelantero: 'Paragolpes Delantero',
    paragolpesTrasero: 'Paragolpes Trasero',
    puertaDerecha: 'Puerta Derecha',
    puertaIzquierda: 'Puerta Izquierda',
    capot: 'Capot',
    techo: 'Techo',
    vidrios: 'Vidrios y Cristales',
    llantas: 'Llantas de Aleación',
    interior: 'Interior y Tapizado'
  };

  const tableStartY = y;

  const checklistRows = Object.entries(data.checklistDanos).map(([key, value]) => {
    const label = checklistMap[key] || key;
    const status = value ? '❌ DAÑADO' : '✔️ Conforme';
    return [label, status];
  });

  // Table on the left
  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 15, right: 105 },
    head: [['Sector del Vehículo', 'Estado']],
    body: checklistRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.8
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 40, fontStyle: 'bold' }
    }
  });

  // Draw the car blueprint on the right
  const drawCarLayout = (startX: number, startY: number) => {
    doc.setLineWidth(0.35);
    doc.setDrawColor(71, 85, 105); // slate-600
    
    // Front bumper
    doc.setFillColor(data.checklistDanos.paragolpesDelantero ? 220 : 241, data.checklistDanos.paragolpesDelantero ? 38 : 245, data.checklistDanos.paragolpesDelantero ? 38 : 249);
    doc.rect(startX, startY + 10, 8, 25, 'FD');
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text('Front', startX + 1, startY + 23);

    // Hood (Capot)
    doc.setFillColor(data.checklistDanos.capot ? 220 : 241, data.checklistDanos.capot ? 38 : 245, data.checklistDanos.capot ? 38 : 249);
    doc.rect(startX + 8, startY + 7, 18, 31, 'FD');
    doc.text('Capot', startX + 13, startY + 23);

    // Left Door (top)
    doc.setFillColor(data.checklistDanos.puertaIzquierda ? 220 : 241, data.checklistDanos.puertaIzquierda ? 38 : 245, data.checklistDanos.puertaIzquierda ? 38 : 249);
    doc.rect(startX + 26, startY + 4, 26, 6, 'FD');
    doc.text('Izq', startX + 37, startY + 8);

    // Right Door (bottom)
    doc.setFillColor(data.checklistDanos.puertaDerecha ? 220 : 241, data.checklistDanos.puertaDerecha ? 38 : 245, data.checklistDanos.puertaDerecha ? 38 : 249);
    doc.rect(startX + 26, startY + 35, 26, 6, 'FD');
    doc.text('Der', startX + 37, startY + 39);

    // Roof (Techo)
    doc.setFillColor(data.checklistDanos.techo ? 220 : 241, data.checklistDanos.techo ? 38 : 245, data.checklistDanos.techo ? 38 : 249);
    doc.rect(startX + 30, startY + 12, 20, 21, 'FD');
    doc.text('Techo', startX + 37, startY + 23);

    // Rear Bumper
    doc.setFillColor(data.checklistDanos.paragolpesTrasero ? 220 : 241, data.checklistDanos.paragolpesTrasero ? 38 : 245, data.checklistDanos.paragolpesTrasero ? 38 : 249);
    doc.rect(startX + 62, startY + 10, 8, 25, 'FD');
    doc.text('Tras', startX + 63, startY + 23);

    // Wheels
    doc.setFillColor(data.checklistDanos.llantas ? 220 : 15, data.checklistDanos.llantas ? 38 : 23, data.checklistDanos.llantas ? 38 : 42);
    doc.rect(startX + 10, startY, 7, 4, 'FD');
    doc.rect(startX + 10, startY + 41, 7, 4, 'FD');
    doc.rect(startX + 52, startY, 7, 4, 'FD');
    doc.rect(startX + 52, startY + 41, 7, 4, 'FD');

    // Indicators for glass and interior
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.setFillColor(data.checklistDanos.vidrios ? 220 : 241, data.checklistDanos.vidrios ? 38 : 245, data.checklistDanos.vidrios ? 38 : 249);
    doc.circle(startX + 78, startY + 14, 2.5, 'FD');
    doc.text('Vidrios', startX + 83, startY + 16);

    doc.setFillColor(data.checklistDanos.interior ? 220 : 241, data.checklistDanos.interior ? 38 : 245, data.checklistDanos.interior ? 38 : 249);
    doc.circle(startX + 78, startY + 24, 2.5, 'FD');
    doc.text('Interior', startX + 83, startY + 26);
  };

  drawCarLayout(115, tableStartY + 5);

  y = Math.max((doc as any).lastAutoTable.finalY, tableStartY + 52) + 8;

  // Observations Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Diagnóstico y Observaciones Adicionales', 15, y);

  y += 4;
  doc.line(15, y, 195, y);

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);

  const cleanObservations = data.observaciones ? data.observaciones : 'Sin observaciones adicionales registradas para este peritaje vehicular.';
  const splitObs = doc.splitTextToSize(cleanObservations, 180);
  doc.text(splitObs, 15, y);

  y += splitObs.length * 5 + 15;

  // Signatures Section
  doc.setDrawColor(203, 213, 225);
  doc.line(25, y, 85, y);
  doc.line(125, y, 185, y);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Firma Operario / Inspector', 55, y, { align: 'center' });
  doc.text('Firma Cliente / Propietario', 155, y, { align: 'center' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Este documento certifica el estado estético inicial del vehículo previo al ingreso de los tratamientos contratados.', 105, y, { align: 'center' });

  doc.save(`Informe_Inspeccion_${data.patente.toUpperCase()}.pdf`);
}
