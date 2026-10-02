/* ani.pm Hard Sub 1.0.0 — MIT license, see LICENSE.txt.
 * Strictly selects the site's Japanese-audio subHard version.
 * No soft-sub, raw or dubbed fallback. No third-party extraction service.
 */
var AP_BASE = 'https://ani.pm';
var AP_PLAYER = 'https://embed.settlar.io';
var AP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
var AP_CACHE = {};

function apLog(error) { console.log('ani.pm Hard Sub: ' + String(error && error.message || error)); }
function apURL(path) { return /^https:\/\//.test(path || '') ? path : AP_BASE + (String(path || '').charAt(0) === '/' ? '' : '/') + path; }
function apID(url) {
    var m = String(url).match(/^https:\/\/ani\.pm\/(?:ani\/(\d+)|embed\/ani\/(\d+)\/\d+\/sub)(?:[/?#]|$)/);
    if (!m) throw new Error('Invalid ani.pm title or episode URL');
    return m[1] || m[2];
}
function apClean(value) { return String(value || '').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim(); }
async function apFetch(url, referer) {
    var headers = {'User-Agent':AP_UA,Referer:referer || AP_BASE + '/',Accept:'application/json, text/html;q=0.9, */*;q=0.8'};
    var response = typeof fetchv2 === 'function' ? await fetchv2(url,headers) : await fetch(url,headers);
    if (typeof response === 'string') return response;
    if (response.status >= 400) throw new Error('HTTP '+response.status+' from '+url.split('/')[2]);
    if (typeof response.text === 'function') return await response.text();
    if (typeof response.body === 'string') return response.body;
    throw new Error('Unsupported network response');
}
async function apJSON(url, referer) {
    var text = await apFetch(url,referer);
    if (/^\s*</.test(text)) throw new Error('Website returned HTML instead of data; check Cloudflare/network access');
    var data = JSON.parse(text);
    if (data.error) throw new Error(typeof data.error === 'string' ? data.error : data.error.message || data.error.code || 'API error');
    return data;
}
function apHardEpisodes(series) {
    var seen = {};
    return (Array.isArray(series.episodeList) ? series.episodeList : []).filter(function(ep) {
        var n = Number(ep.number);
        if (!ep.available || ep.available.subHard !== true || !isFinite(n) || n < 1 || Math.floor(n) !== n || seen[n]) return false;
        seen[n] = true;
        return true;
    }).sort(function(a,b) { return Number(a.number)-Number(b.number); });
}
async function apSeries(id, fresh) {
    var entry=AP_CACHE[id];
    if (!fresh && entry && Date.now()-entry.time < 120000) return entry.data;
    var response=await apJSON(AP_BASE+'/api/partner/v1/series/'+encodeURIComponent(id));
    if (!response.data || !Array.isArray(response.data.episodeList)) throw new Error('Missing episode data');
    if (String(response.data.anilistId) !== String(id)) throw new Error('Title identity mismatch');
    var keys=Object.keys(AP_CACHE);
    if (keys.length>=32) delete AP_CACHE[keys[0]];
    AP_CACHE[id]={time:Date.now(),data:response.data};
    return response.data;
}
async function searchResults(keyword) {
    try {
        keyword=String(keyword || '').trim();
        if (keyword.length<2) return '[]';
        var answer=await apJSON(AP_BASE+'/api/partner/v1/titles?q='+encodeURIComponent(keyword.slice(0,120))+'&limit=30&page=1');
        var titles=Array.isArray(answer.data) ? answer.data : [],results=[],seen={};
        // Verify availability; a generic "sub" tag does not prove hard subtitles.
        // Batches limit concurrent requests and preserve the site's result order.
        for (var i=0;i<titles.length;i+=4) {
            var batch=await Promise.all(titles.slice(i,i+4).map(async function(title) {
                try {
                    if (!title.anilistId) return null;
                    var series=await apSeries(String(title.anilistId),false);
                    if (!apHardEpisodes(series).length) return null;
                    return {title:apClean(title.title),image:apURL(title.poster || series.poster),href:AP_BASE+'/ani/'+title.anilistId};
                } catch(error) { apLog(error); return null; }
            }));
            batch.forEach(function(result) { if(result && result.title && !seen[result.href]) { seen[result.href]=true; results.push(result); } });
        }
        return JSON.stringify(results);
    } catch(error) { apLog(error); return '[]'; }
}
async function extractDetails(url) {
    try {
        var data=await apSeries(apID(url),false);
        var count=apHardEpisodes(data).length;
        return JSON.stringify({description:apClean(data.synopsis)+'\n\nHard-sub episodes available: '+count+'. Only confirmed burned-in subtitle versions are listed.',aliases:apClean(data.nativeTitle),airdate:data.year ? String(data.year) : ''});
    } catch(error) { apLog(error); return JSON.stringify({description:'Unable to load ani.pm details.',aliases:'',airdate:''}); }
}
async function extractEpisodes(url) {
    try {
        var id=apID(url),series=await apSeries(id,false);
        return JSON.stringify(apHardEpisodes(series).map(function(ep) {
            return {number:Number(ep.number),href:AP_BASE+'/embed/ani/'+id+'/'+Number(ep.number)+'/sub?hardsub=1'};
        }));
    } catch(error) { apLog(error); return '[]'; }
}
function apRequireHardSession(session, episode) {
    if (session.hardsub !== true || session.lang !== 'sub' || Number(session.episode)!==episode || !session.availability || session.availability.subHard !== true) {
        throw new Error('Hard subtitles not confirmed; refusing soft-sub/dub fallback');
    }
    if (typeof session.token !== 'string' || !session.token) throw new Error('Missing player session token');
    if (!/^https:\/\/embed\.settlar\.io\/embed\/v1\?/.test(session.embedUrl || '')) throw new Error('Player host changed');
}
function apStreamResult(player) {
    if (player.kind !== 'hls' || !/^https:\/\/media\.settlar\.io\//.test(player.source || '')) throw new Error('Unsupported source format or media host');
    if (player.audioLang && !/^(ja|jpn|japanese)$/i.test(player.audioLang)) throw new Error('Japanese audio not confirmed');
    if (player.subtitles != null && (!Array.isArray(player.subtitles) || player.subtitles.length)) throw new Error('External subtitle tracks found; refusing ambiguous source');
    var headers={Referer:AP_PLAYER+'/',Origin:AP_PLAYER,'User-Agent':AP_UA};
    if (player.keyProof) headers['X-Settlar-Key-Proof']=String(player.keyProof);
    return {streams:[{title:'ani.pm • Hard Sub',streamUrl:player.source,headers:headers}]};
}
async function extractStreamUrl(url) {
    try {
        var id=apID(url),match=String(url).match(/\/embed\/ani\/\d+\/(\d+)\/sub(?:[?#]|$)/);
        if (!match) throw new Error('Select a hard-sub episode');
        var episode=Number(match[1]),series=await apSeries(id,true);
        if (!apHardEpisodes(series).some(function(ep) { return Number(ep.number)===episode; })) throw new Error('No confirmed hard-sub version for this episode');
        var embed=AP_BASE+'/embed/ani/'+id+'/'+episode+'/sub?hardsub=1';
        var html=await apFetch(embed);
        var configMatch=html.match(/<script\b[^>]*id=["']anipm-embed-config["'][^>]*>([\s\S]*?)<\/script>/i);
        if (!configMatch) throw new Error('Player configuration unavailable');
        var cfg=JSON.parse(configMatch[1]);
        if (!cfg.nonce || !cfg.title || String(cfg.title.anilistId)!==id || cfg.playerOrigin!==AP_PLAYER) throw new Error('Player configuration changed');
        var query='n='+encodeURIComponent(cfg.nonce)+'&id='+encodeURIComponent(id)+'&ep='+episode+'&lang=sub&hardsub=1&adult=1';
        var session=await apJSON(AP_BASE+'/api/partner/v1/session?'+query,embed);
        apRequireHardSession(session,episode);
        var player=await apJSON(AP_PLAYER+'/api/embed/session?t='+encodeURIComponent(session.token),session.embedUrl);
        return JSON.stringify(apStreamResult(player));
    } catch(error) { apLog(error); return JSON.stringify({streams:[]}); }
}
