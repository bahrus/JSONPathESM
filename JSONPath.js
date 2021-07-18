/* JSONPath 0.8.0 - XPath for JSON
 *
 * Copyright (c) 2007 Stefan Goessner (goessner.net)
 * Licensed under the MIT (MIT-LICENSE.txt) licence.
 */
export function jsonPath(obj, expr, arg) {
    const $ = obj;
    const p = new P($, arg);
    if (expr && obj && (p.resultType == "VALUE" || p.resultType == "PATH")) {
        p.trace(p.normalize(expr).replace(/^\$;/, ""), obj, "$");
        return p.result.length ? p.result : false;
    }
}
class P {
    $;
    constructor($, arg) {
        this.$ = $;
        this.resultType = arg && arg.resultType || "VALUE";
    }
    resultType;
    result = [];
    normalize(expr) {
        var subx = [];
        return expr.replace(/[\['](\??\(.*?\))[\]']/g, function ($0, $1) { return "[#" + (subx.push($1) - 1) + "]"; })
            .replace(/'?\.'?|\['?/g, ";")
            .replace(/;;;|;;/g, ";..;")
            .replace(/;$|'?\]|'$/g, "")
            .replace(/#([0-9]+)/g, function ($0, $1) { return subx[$1]; });
    }
    asPath(path) {
        var x = path.split(";"), p = "$";
        for (var i = 1, n = x.length; i < n; i++)
            p += /^[0-9*]+$/.test(x[i]) ? ("[" + x[i] + "]") : ("['" + x[i] + "']");
        return p;
    }
    store(p, v) {
        if (p)
            this.result[this.result.length] = this.resultType == "PATH" ? this.asPath(p) : v;
        return !!p;
    }
    trace(expr, val, path) {
        if (expr) {
            var x = expr.split(";"), loc = x.shift();
            x = x.join(";");
            if (val && val.hasOwnProperty(loc))
                this.trace(x, val[loc], path + ";" + loc);
            else if (loc === "*")
                this.walk(loc, x, val, path, (m, l, x, v, p) => { this.trace(m + ";" + x, v, p); });
            else if (loc === "..") {
                this.trace(x, val, path);
                this.walk(loc, x, val, path, (m, l, x, v, p) => { typeof v[m] === "object" && this.trace("..;" + x, v[m], p + ";" + m); });
            }
            else if (/,/.test(loc)) { // [name1,name2,...]
                for (var s = loc.split(/'?,'?/), i = 0, n = s.length; i < n; i++)
                    this.trace(s[i] + ";" + x, val, path);
            }
            else if (/^\(.*?\)$/.test(loc)) // [(expr)]
                this.trace(this.eval(loc, val, path.substr(path.lastIndexOf(";") + 1)) + ";" + x, val, path);
            else if (/^\?\(.*?\)$/.test(loc)) // [?(expr)]
                this.walk(loc, x, val, path, (m, l, x, v, p) => { if (this.eval(l.replace(/^\?\((.*?)\)$/, "$1"), v[m], m))
                    this.trace(m + ";" + x, v, p); });
            else if (/^(-?[0-9]*):(-?[0-9]*):?([0-9]*)$/.test(loc)) // [start:end:step]  phyton slice syntax
                this.slice(loc, x, val, path);
        }
        else
            this.store(path, val);
    }
    walk(loc, expr, val, path, f) {
        if (val instanceof Array) {
            for (var i = 0, n = val.length; i < n; i++)
                if (i in val)
                    f(i, loc, expr, val, path);
        }
        else if (typeof val === "object") {
            for (var m in val)
                if (val.hasOwnProperty(m))
                    f(m, loc, expr, val, path);
        }
    }
    slice(loc, expr, val, path) {
        if (val instanceof Array) {
            var len = val.length, start = 0, end = len, step = 1;
            loc.replace(/^(-?[0-9]*):(-?[0-9]*):?(-?[0-9]*)$/g, function ($0, $1, $2, $3) { start = parseInt($1 || start); end = parseInt($2 || end); step = parseInt($3 || step); });
            start = (start < 0) ? Math.max(0, start + len) : Math.min(len, start);
            end = (end < 0) ? Math.max(0, end + len) : Math.min(len, end);
            for (var i = start; i < end; i += step)
                this.trace(i + ";" + expr, val, path);
        }
    }
    eval(x, _v, _vname) {
        try {
            return this.$ && _v && eval(x.replace(/@/g, "_v"));
        }
        catch (e) {
            throw new SyntaxError("jsonPath: " + e.message + ": " + x.replace(/@/g, "_v").replace(/\^/g, "_a"));
        }
    }
}
