import jwt from 'jsonwebtoken';
export function signSession(payload) {
return jwt.sign(payload, process.env.JWT_SECRET || 'jwt_secret', {
expiresIn: '30d' });
}
export function authGuard(req, res, next) {
const token = req.signedCookies?.session;
if (!token) return res.status(401).json({ error: 'unauthorized' });
try {
const data = jwt.verify(token, process.env.JWT_SECRET || 'jwt_secret');
req.user = data;
next();
} catch {
return res.status(401).json({ error: 'invalid' });
}
}
export function adminGuard(req, res, next) {
if (!req.user) return res.status(401).json({ error: 'unauthorized' });
const admins = (process.env.ADMIN_EMAILS || '').split(',').map(s =>
s.trim().toLowerCase());
if (admins.includes((req.user.email || '').toLowerCase())) return next();
return res.status(403).json({ error: 'forbidden' });
}
