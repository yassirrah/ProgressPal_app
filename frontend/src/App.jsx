import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import Home from './components/Home';
import Feed from './components/Feed';
import Friends from './components/Friends';
import MySessions from './components/MySessions';
import ActivityTypes from './components/ActivityTypes';
import Navbar from './components/Navbar';
import { getStoredUser } from './lib/api';
import './App.css';

function App() {
  const user = getStoredUser();
  return (
    <Router>
      <div className="app-shell">
        <Navbar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/my-sessions" element={<MySessions />} />
            <Route path="/activity-types" element={<ActivityTypes />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
