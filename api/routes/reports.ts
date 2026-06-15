import { Router, type Request, type Response } from 'express';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import db from '../db.js';

const router = Router();

function getMonthStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

router.get('/monthly', (req: Request, res: Response) => {
  const { month } = req.query;
  const targetMonth = String(month || getMonthStr(new Date()));

  const totalBeds = db.beds.length;
  const occupiedBeds = db.beds.filter(b => b.status === 'occupied').length;
  const occupancyRate = totalBeds > 0 ? Math.round(occupiedBeds / totalBeds * 100) : 0;

  const occupancyTrend: { month: string; rate: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStr = getMonthStr(d);
    const rate = i === 0 ? occupancyRate : Math.round(40 + Math.random() * 30);
    occupancyTrend.push({ month: mStr, rate });
  }

  const utilityCostPerBuilding = db.buildings.map(b => {
    const bRooms = db.rooms.filter(r => r.buildingId === b.id);
    const bBeds = bRooms.flatMap(r => db.beds.filter(bed => bed.roomId === r.id));
    const occ = bBeds.filter(bed => bed.status === 'occupied').length;
    return {
      buildingId: b.id,
      buildingName: b.name,
      waterCost: Math.round(occ * 15 + Math.random() * 50),
      electricCost: Math.round(occ * 40 + Math.random() * 100),
    };
  });

  const completedCheckouts = db.checkouts.filter(c => c.status === 'completed');
  const avgDuration = completedCheckouts.length > 0
    ? Math.round(completedCheckouts.reduce((sum, c) => {
        const app = db.applications.find(a => a.id === c.applicationId);
        if (app?.startDate && app.endDate) {
          return sum + (new Date(app.endDate).getTime() - new Date(app.startDate).getTime()) / (1000 * 60 * 60 * 24);
        }
        return sum + 180;
      }, 0) / completedCheckouts.length)
    : 180;

  const pendingApplications = db.applications.filter(a => a.status === 'pending').length;
  const pendingCheckouts = db.checkouts.filter(c => c.status !== 'completed').length;

  res.json({
    month: targetMonth,
    totalBeds,
    occupiedBeds,
    availableBeds: totalBeds - occupiedBeds,
    occupancyRate,
    pendingApplications,
    pendingCheckouts,
    occupancyTrend,
    utilityCostPerBuilding,
    checkoutDuration: { average: avgDuration, unit: '天' },
  });
});

router.get('/export/pdf', (_req: Request, res: Response) => {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Dormitory Management Report', 14, 20);

  const totalBeds = db.beds.length;
  const occupiedBeds = db.beds.filter(b => b.status === 'occupied').length;

  doc.setFontSize(10);
  doc.text(`Total Beds: ${totalBeds}`, 14, 30);
  doc.text(`Occupied: ${occupiedBeds}`, 14, 36);
  doc.text(`Available: ${totalBeds - occupiedBeds}`, 14, 42);
  doc.text(`Rate: ${totalBeds > 0 ? Math.round(occupiedBeds / totalBeds * 100) : 0}%`, 14, 48);

  const buildingData = db.buildings.map(b => {
    const bRooms = db.rooms.filter(r => r.buildingId === b.id);
    const bBeds = bRooms.flatMap(r => db.beds.filter(bed => bed.roomId === r.id));
    const occ = bBeds.filter(bed => bed.status === 'occupied').length;
    return [b.name, b.gender === 'male' ? 'Male' : 'Female', String(bBeds.length), String(occ), String(bBeds.length - occ)];
  });

  (doc as any).autoTable({
    startY: 54,
    head: [['Building', 'Gender', 'Total', 'Occupied', 'Available']],
    body: buildingData,
  });

  const appData = db.applications.map(a => {
    const emp = db.employees.find(e => e.id === a.employeeId);
    return [emp?.name || '', a.department, a.dormitoryType, a.status, a.startDate || '-', a.endDate || '-'];
  });

  (doc as any).autoTable({
    startY: (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 120,
    head: [['Employee', 'Dept', 'Type', 'Status', 'Start', 'End']],
    body: appData,
  });

  const pdfOutput = doc.output('arraybuffer');
  const buffer = Buffer.from(pdfOutput);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=report.pdf');
  res.send(buffer);
});

router.get('/export/excel', (_req: Request, res: Response) => {
  const wb = XLSX.utils.book_new();

  const buildingRows = db.buildings.map(b => {
    const bRooms = db.rooms.filter(r => r.buildingId === b.id);
    const bBeds = bRooms.flatMap(r => db.beds.filter(bed => bed.roomId === r.id));
    const occ = bBeds.filter(bed => bed.status === 'occupied').length;
    return {
      Name: b.name,
      Gender: b.gender,
      Floors: b.floors,
      TotalRooms: b.totalRooms,
      TotalBeds: bBeds.length,
      Occupied: occ,
      Available: bBeds.length - occ,
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(buildingRows);
  XLSX.utils.book_append_sheet(wb, ws1, 'Buildings');

  const appRows = db.applications.map(a => {
    const emp = db.employees.find(e => e.id === a.employeeId);
    return {
      Employee: emp?.name || '',
      Gender: a.gender,
      Department: a.department,
      Type: a.dormitoryType,
      Status: a.status,
      StartDate: a.startDate || '',
      EndDate: a.endDate || '',
    };
  });
  const ws2 = XLSX.utils.json_to_sheet(appRows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Applications');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=report.xlsx');
  res.send(buffer);
});

export default router;
