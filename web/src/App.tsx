          import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
          import Login from './pages/Login';
          import AuthCallback from './pages/AuthCallback';
          import Dashboard from './pages/Dashboard';
          import './App.css';

          function App() {
            return (
              <Router>
                <Routes>
                  <Route path="/" element={<Login />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Router>
            );
          }

          export default App;