import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminPage from './components/AdminPage';
import ErdPage from './components/ErdPage';
import StudentLoginPage from './components/StudentLoginPage';
import InstructorLoginPage from './components/InstructorLoginPage';
import InstructorDashboard from './components/InstructorDashboard';
import StatusPage from './components/StatusPage';
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
