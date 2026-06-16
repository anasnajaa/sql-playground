import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './pages/guest/App';
import ErdPage from './pages/guest/ErdPage';
import StudentLoginPage from './pages/student/StudentLoginPage';
import InstructorLoginPage from './pages/instructor/InstructorLoginPage';
import InstructorDashboard from './pages/instructor/InstructorDashboard';
import StatusPage from './pages/instructor/StatusPage';
import AdminPage from './pages/instructor/AdminPage';
import './index.css';

const path = window.location.pathname;
const Page = path === '/admin'            ? AdminPage
           : path === '/erd'              ? ErdPage
           : path === '/login'            ? StudentLoginPage
           : path === '/instructor/login' ? InstructorLoginPage
           : path === '/instructor'       ? InstructorDashboard
           : path === '/status'           ? StatusPage
           : App;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Page /></React.StrictMode>
);
