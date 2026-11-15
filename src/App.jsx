import React from 'react';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import PaymentsPage from './pages/payments.tsx';
import Home from './pages/home.tsx';
import AddClient from './pages/add-client.tsx';
import ClientProfile from './pages/client-profile.tsx';
import CandidatesListsPage from './pages/candidates-lists.tsx';
import CandidateListDetailsPage from './pages/candidate-list-details.tsx';
import CalendarPage from './pages/calendar.tsx';
import VehiclesPage from './pages/vehicles.tsx';

function App() {
  return (
    <div>
      <Router>
        <Routes>
          <Route path="/" element={<PaymentsPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/clients" element={<Home />} />
          <Route path="/clients/new" element={<AddClient />} />
          <Route path="/clients/:id" element={<ClientProfile />} />
          <Route path="/candidates-lists" element={<CandidatesListsPage />} />
          <Route path="/candidates-lists/:id" element={<CandidateListDetailsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/about" element={<div>About Page</div>} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
