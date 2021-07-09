import {IArgs} from './types.d.js';
/* JSONPath 0.8.0 - XPath for JSON
 *
 * Copyright (c) 2007 Stefan Goessner (goessner.net)
 * Licensed under the MIT (MIT-LICENSE.txt) licence.
 */
export function jsonPath(obj: any, expr: string, arg?: IArgs) : any {
   const $ = obj;
   const p = new P($, arg);
   
   if (expr && obj && (p.resultType == "VALUE" || p.resultType == "PATH")) {
       p.trace(p.normalize(expr).replace(/^\$;/,""), obj, "$");
       return p.result.length ? p.result : false;
   }
 } 

class P {
   constructor(public $: any, arg?: IArgs){
      this.resultType = arg && arg.resultType || "VALUE";
   }
   resultType: string;
   result = [];
   normalize(expr: string) {
      var subx: any = [];
      return expr.replace(/[\['](\??\(.*?\))[\]']/g, function($0,$1){return "[#"+(subx.push($1)-1)+"]";})
                 .replace(/'?\.'?|\['?/g, ";")
                 .replace(/;;;|;;/g, ";..;")
                 .replace(/;$|'?\]|'$/g, "")
                 .replace(/#([0-9]+)/g, function($0,$1){return subx[$1];});
   }
   asPath(path: string) {
      var x = path.split(";"), p = "$";
      for (var i=1,n=x.length; i<n; i++)
         p += /^[0-9*]+$/.test(x[i]) ? ("["+x[i]+"]") : ("['"+x[i]+"']");
      return p;
   }
   store(p: any, v: any) {
      if (p) (this.result as any)[this.result.length] = this.resultType == "PATH" ? this.asPath(p) : v;
      return !!p;
   }
   trace(expr: any, val: any, path: any) {
      if (expr) {
         var x = expr.split(";"), loc = x.shift();
         x = x.join(";");
         if (val && val.hasOwnProperty(loc))
            this.trace(x, val[loc], path + ";" + loc);
         else if (loc === "*")
            this.walk(loc, x, val, path, (m: any,l: any,x: any,v: any,p: any) => { this.trace(m+";"+x,v,p); });
         else if (loc === "..") {
            this.trace(x, val, path);
            this.walk(loc, x, val, path, (m: any,l: any,x: any,v: any,p: any) => { typeof v[m] === "object" && this.trace("..;"+x,v[m],p+";"+m); });
         }
         else if (/,/.test(loc)) { // [name1,name2,...]
            for (var s=loc.split(/'?,'?/),i=0,n=s.length; i<n; i++)
               this.trace(s[i]+";"+x, val, path);
         }
         else if (/^\(.*?\)$/.test(loc)) // [(expr)]
            this.trace(this.eval(loc, val, path.substr(path.lastIndexOf(";")+1))+";"+x, val, path);
         else if (/^\?\(.*?\)$/.test(loc)) // [?(expr)]
            this.walk(loc, x, val, path, (m: any,l: any,x: any,v: any,p: any) => { if (this.eval(l.replace(/^\?\((.*?)\)$/,"$1"),v[m],m)) this.trace(m+";"+x,v,p); });
         else if (/^(-?[0-9]*):(-?[0-9]*):?([0-9]*)$/.test(loc)) // [start:end:step]  phyton slice syntax
            this.slice(loc, x, val, path);
      }
      else
         this.store(path, val);
   }
   walk(loc: any, expr: any, val: any, path: any, f: any) {
      if (val instanceof Array) {
         for (var i=0,n=val.length; i<n; i++)
            if (i in val)
               f(i,loc,expr,val,path);
      }
      else if (typeof val === "object") {
         for (var m in val)
            if (val.hasOwnProperty(m))
               f(m,loc,expr,val,path);
      }
   }
   slice(loc: any, expr: any, val: any, path: any) {
      if (val instanceof Array) {
         var len=val.length, start=0, end=len, step=1;
         loc.replace(/^(-?[0-9]*):(-?[0-9]*):?(-?[0-9]*)$/g, function($0: any,$1: any,$2: any,$3: any){start=parseInt($1||start);end=parseInt($2||end);step=parseInt($3||step);});
         start = (start < 0) ? Math.max(0,start+len) : Math.min(len,start);
         end   = (end < 0)   ? Math.max(0,end+len)   : Math.min(len,end);
         for (var i=start; i<end; i+=step)
            this.trace(i+";"+expr, val, path);
      }
   }
   eval(x: any, _v: any, _vname: any) {
      try { return this.$ && _v && eval(x.replace(/@/g, "_v")); }
      catch(e) { throw new SyntaxError("jsonPath: " + e.message + ": " + x.replace(/@/g, "_v").replace(/\^/g, "_a")); }
   }
}
 