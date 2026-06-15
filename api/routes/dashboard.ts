import { Router, type Request, type Response } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const totalBeds = db.beds.length;
  const occupiedBeds = db.beds.filter(b => b.status === 'occupied').length;
  const availableBeds = db.beds.filter(b => b.status === 'available').length;
  const occupancyRate = totalBeds > 0 ? Math.round(occupiedBeds / totalBeds * 100) : 0;

  const pendingApplications = db.applications.filter(a => a.status === 'pending').length;
  const pendingCheckouts = db.checkouts.filter(c => c.status !== 'completed').length;

  const expiringCount = db.warnings.filter(w => w.level === 'expiring' && w.status === 'pending').length;
  const expiredCount = db.warnings.filter(w => w.level === 'expired' && w.status === 'pending').length;

  const recentActivities = [...db.operationLogs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  res.json({
    totalBeds,
    occupiedBeds,
    availableBeds,
    occupancyRate,
    pendingApplications,
    pendingCheckouts,
    expiringCount,
    expiredCount,
    recentActivities,
  });
});

export default router;
