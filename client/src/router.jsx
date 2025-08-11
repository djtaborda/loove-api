import { createBrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import Forgot from './components/Forgot.jsx';
import Plans from './components/Plans.jsx';
import Downloads from './components/Downloads.jsx';
import Favorites from './components/Favorites.jsx';
import History from './components/History.jsx';
import Playlists from './components/Playlists.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
export default createBrowserRouter([
{ path: '/', element: <App /> },
{ path: '/login', element: <Login /> },
{ path: '/register', element: <Register /> },
{ path: '/forgot', element: <Forgot /> },
{ path: '/planos', element: <Plans /> },
{ path: '/downloads', element: <Downloads /> },
{ path: '/favoritos', element: <Favorites /> },
{ path: '/historico', element: <History /> },
{ path: '/playlists', element: <Playlists /> },
{ path: '/admin', element: <AdminDashboard /> }
]);
