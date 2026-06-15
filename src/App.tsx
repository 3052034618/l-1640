import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import CheckinList from "@/pages/CheckinList";
import CheckinDetail from "@/pages/CheckinDetail";
import CheckoutList from "@/pages/CheckoutList";
import CheckoutDetail from "@/pages/CheckoutDetail";
import DormitoryList from "@/pages/DormitoryList";
import DormitoryDetail from "@/pages/DormitoryDetail";
import DormitoryImport from "@/pages/DormitoryImport";
import WarningList from "@/pages/WarningList";
import Report from "@/pages/Report";
import LogList from "@/pages/LogList";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/checkin" element={<CheckinList />} />
          <Route path="/checkin/:id" element={<CheckinDetail />} />
          <Route path="/checkout" element={<CheckoutList />} />
          <Route path="/checkout/:id" element={<CheckoutDetail />} />
          <Route path="/dormitory" element={<DormitoryList />} />
          <Route path="/dormitory/:buildingId" element={<DormitoryDetail />} />
          <Route path="/dormitory/import" element={<DormitoryImport />} />
          <Route path="/warning" element={<WarningList />} />
          <Route path="/report" element={<Report />} />
          <Route path="/log" element={<LogList />} />
        </Route>
      </Routes>
    </Router>
  );
}
