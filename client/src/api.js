const API = '';
export async function api(path, opts={}){
const res = await fetch(path, { credentials:'include', headers:{ 'ContentType':'application/json' }, ...opts, body: opts.body ?
JSON.stringify(opts.body) : undefined });
if (!res.ok) throw new Error(await res.text());
return res.json();
}
export const Auth = {
me: () => api('/user/me'),
login: (email, password) => api('/auth/login', { method:'POST', body:{
email, password } }),
register: (name, email, password) => api('/auth/register', {
method:'POST', body:{ name, email, password } }),
forgot: (email) => api('/auth/forgot', { method:'POST', body:{ email } }),
logout: () => api('/auth/logout', { method:'POST' })
};
export const Content = {
folders: () => api('/content/folders'),
tracks: (params={}) => {
const u = new URL('/content/tracks', location.origin);
if (params.prefix) u.searchParams.set('prefix', params.prefix);
if (params.token) u.searchParams.set('token', params.token);
if (params.search) u.searchParams.set('search', params.search);
return api(u.pathname + u.search);
},
streamUrl: (key) => {
const u = new URL('/content/stream-url', location.origin);
u.searchParams.set('key', key);
return api(u.pathname + u.search);
}
};
export const User = {
favorites: () => api('/user/favorites'),
favAdd: (key) => api('/user/favorites', { method:'POST', body:{ key,
op:'add' } }),
favRemove: (key) => api('/user/favorites', { method:'POST', body:{ key,
op:'remove' } }),
history: () => api('/user/history'),
historyAdd: (key) => api('/user/history', { method:'POST', body:{ key } }),
playlists: () => api('/user/playlists'),
playlistCreate: (name) => api('/user/playlists', { method:'POST', body:{
name } }),
playlistRename: (id, name) => api(`/user/playlists/${id}`, { method:'PUT',
body:{ name } }),
playlistDelete: (id) => api(`/user/playlists/${id}`, { method:'DELETE' }),
playlistAddTrack: (id, key) => api(`/user/playlists/${id}/tracks`, {
method:'POST', body:{ key } }),
playlistRemoveTrack: (id, key) => api(`/user/playlists/${id}/tracks`, {
method:'DELETE', body:{ key } }),
ping: () => api('/user/session/ping', { method:'POST' })
};
export const Push = {
publicKey: () => api('/push/public-key'),
subscribe: (sub) => api('/push/subscribe', { method:'POST', body: sub })
};
