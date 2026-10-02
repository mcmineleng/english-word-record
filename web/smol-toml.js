/* esm.sh - smol-toml@1.1.3 */
function P(e,n){let t=e.slice(0,n).split(/\r\n|\n|\r/g);return[t.length,t.pop().length+1]}function C(e,n,t){let l=e.split(/\r\n|\n|\r/g),i="",r=(Math.log10(n+1)|0)+1;for(let o=n-1;o<=n+1;o++){let f=l[o-1];f&&(i+=o.toString().padEnd(r," "),i+=":  ",i+=f,i+=`
`,o===n&&(i+=" ".repeat(r+t+2),i+=`^
`))}return i}var a=class extends Error{line;column;codeblock;constructor(n,t){let[l,i]=P(t.toml,t.ptr),r=C(t.toml,l,i);super(`Invalid TOML document: ${n}

${r}`,t),this.line=l,this.column=i,this.codeblock=r}};var R=/^(\d{4}-\d{2}-\d{2})?[T ]?(?:(\d{2}):\d{2}:\d{2}(?:\.\d+)?)?(Z|[-+]\d{2}:\d{2})?$/i,m=class e extends Date{#n=!1;#t=!1;#e=null;constructor(n){let t=!0,l=!0,i="Z";if(typeof n=="string"){let r=n.match(R);r?(r[1]||(t=!1,n=`0000-01-01T${n}`),l=!!r[2],r[2]&&+r[2]>23?n="":(i=r[3]||null,n=n.toUpperCase(),i||(n+="Z"))):n=""}super(n),isNaN(this.getTime())||(this.#n=t,this.#t=l,this.#e=i)}isDateTime(){return this.#n&&this.#t}isLocal(){return!this.#n||!this.#t||!this.#e}isDate(){return this.#n&&!this.#t}isTime(){return this.#t&&!this.#n}isValid(){return this.#n||this.#t}toISOString(){let n=super.toISOString();if(this.isDate())return n.slice(0,10);if(this.isTime())return n.slice(11,23);if(this.#e===null)return n.slice(0,-1);if(this.#e==="Z")return n;let t=+this.#e.slice(1,3)*60+ +this.#e.slice(4,6);return t=this.#e[0]==="-"?t:-t,new Date(this.getTime()-t*6e4).toISOString().slice(0,-1)+this.#e}static wrapAsOffsetDateTime(n,t="Z"){let l=new e(n);return l.#e=t,l}static wrapAsLocalDateTime(n){let t=new e(n);return t.#e=null,t}static wrapAsLocalDate(n){let t=new e(n);return t.#t=!1,t.#e=null,t}static wrapAsLocalTime(n){let t=new e(n);return t.#n=!1,t.#e=null,t}};function w(e,n=0,t=e.length){let l=e.indexOf(`
`,n);return e[l-1]==="\r"&&l--,l<=t?l:-1}function h(e,n){for(let t=n;t<e.length;t++){let l=e[t];if(l===`
`)return t;if(l==="\r"&&e[t+1]===`
`)return t+1;if(l<" "&&l!=="	"||l==="\x7F")throw new a("control characters are not allowed in comments",{toml:e,ptr:n})}return e.length}function d(e,n,t,l){let i;for(;(i=e[n])===" "||i==="	"||!t&&(i===`
`||i==="\r"&&e[n+1]===`
`);)n++;return l||i!=="#"?n:d(e,h(e,n),t)}function T(e,n,t,l,i=!1){if(!l)return n=w(e,n),n<0?e.length:n;for(let r=n;r<e.length;r++){let o=e[r];if(o==="#")r=w(e,r);else{if(o===t)return r+1;if(o===l)return r;if(i&&(o===`
`||o==="\r"&&e[r+1]===`
`))return r}}throw new a("cannot find end of structure",{toml:e,ptr:n})}function y(e,n){let t=e[n],l=t===e[n+1]&&e[n+1]===e[n+2]?e.slice(n,n+3):t;n+=l.length-1;do n=e.indexOf(l,++n);while(n>-1&&t!=="'"&&e[n-1]==="\\"&&e[n-2]!=="\\");return n>-1&&(n+=l.length,l.length>1&&(e[n]===t&&n++,e[n]===t&&n++)),n}var Z=/^((0x[0-9a-fA-F](_?[0-9a-fA-F])*)|(([+-]|0[ob])?\d(_?\d)*))$/,v=/^[+-]?\d(_?\d)*(\.\d(_?\d)*)?([eE][+-]?\d(_?\d)*)?$/,z=/^[+-]?0[0-9_]/,K=/^[0-9a-f]{4,8}$/i,k={b:"\b",t:"	",n:`
`,f:"\f",r:"\r",'"':'"',"\\":"\\"};function b(e,n=0,t=e.length){let l=e[n]==="'",i=e[n++]===e[n]&&e[n]===e[n+1];i&&(t-=2,e[n+=2]==="\r"&&n++,e[n]===`
`&&n++);let r=0,o,f="",u=n;for(;n<t-1;){let c=e[n++];if(c===`
`||c==="\r"&&e[n]===`
`){if(!i)throw new a("newlines are not allowed in strings",{toml:e,ptr:n-1})}else if(c<" "&&c!=="	"||c==="\x7F")throw new a("control characters are not allowed in strings",{toml:e,ptr:n-1});if(o){if(o=!1,c==="u"||c==="U"){let s=e.slice(n,n+=c==="u"?4:8);if(!K.test(s))throw new a("invalid unicode escape",{toml:e,ptr:r});try{f+=String.fromCodePoint(parseInt(s,16))}catch{throw new a("invalid unicode escape",{toml:e,ptr:r})}}else if(i&&(c===`
`||c===" "||c==="	"||c==="\r")){if(n=d(e,n-1,!0),e[n]!==`
`&&e[n]!=="\r")throw new a("invalid escape: only line-ending whitespace may be escaped",{toml:e,ptr:r});n=d(e,n)}else if(c in k)f+=k[c];else throw new a("unrecognized escape sequence",{toml:e,ptr:r});u=n}else!l&&c==="\\"&&(r=n-1,o=!0,f+=e.slice(u,r))}return f+e.slice(u,t-1)}function I(e,n,t){if(e==="true")return!0;if(e==="false")return!1;if(e==="-inf")return-1/0;if(e==="inf"||e==="+inf")return 1/0;if(e==="nan"||e==="+nan"||e==="-nan")return NaN;if(e==="-0")return 0;let l;if((l=Z.test(e))||v.test(e)){if(z.test(e))throw new a("leading zeroes are not allowed",{toml:n,ptr:t});let r=+e.replace(/_/g,"");if(isNaN(r))throw new a("invalid number",{toml:n,ptr:t});if(l&&!Number.isSafeInteger(r))throw new a("integer value cannot be represented losslessly",{toml:n,ptr:t});return r}let i=new m(e);if(!i.isValid())throw new a("invalid value",{toml:n,ptr:t});return i}function M(e,n,t,l){let i=e.slice(n,t),r=i.indexOf("#");r>-1&&(h(e,r),i=i.slice(0,r));let o=i.trimEnd();if(!l){let f=i.indexOf(`
`,o.length);if(f>-1)throw new a("newlines are not allowed in inline tables",{toml:e,ptr:n+f})}return[o,r]}function g(e,n,t){let l=e[n];if(l==="["||l==="{"){let[o,f]=l==="["?N(e,n):$(e,n),u=T(e,f,",",t);if(t==="}"){let c=w(e,f,u);if(c>-1)throw new a("newlines are not allowed in inline tables",{toml:e,ptr:c})}return[o,u]}let i;if(l==='"'||l==="'"){i=y(e,n);let o=b(e,n,i);if(t){if(i=d(e,i,t!=="]"),e[i]&&e[i]!==","&&e[i]!==t&&e[i]!==`
`&&e[i]!=="\r")throw new a("unexpected character encountered",{toml:e,ptr:i});i+=+(e[i]===",")}return[o,i]}i=T(e,n,",",t);let r=M(e,n,i-+(e[i-1]===","),t==="]");if(!r[0])throw new a("incomplete key-value declaration: no value specified",{toml:e,ptr:n});return t&&r[1]>-1&&(i=d(e,n+r[1]),i+=+(e[i]===",")),[I(r[0],e,n),i]}var F=/^[a-zA-Z0-9-_]+[ \t]*$/;function x(e,n,t="="){let l=n-1,i=[],r=e.indexOf(t,n);if(r<0)throw new a("incomplete key-value: cannot find end of key",{toml:e,ptr:n});do{let o=e[n=++l];if(o!==" "&&o!=="	")if(o==='"'||o==="'"){if(o===e[n+1]&&o===e[n+2])throw new a("multiline strings are not allowed in keys",{toml:e,ptr:n});let f=y(e,n);if(f<0)throw new a("unfinished string encountered",{toml:e,ptr:n});l=e.indexOf(".",f);let u=e.slice(f,l<0||l>r?r:l),c=w(u);if(c>-1)throw new a("newlines are not allowed in keys",{toml:e,ptr:n+l+c});if(u.trimStart())throw new a("found extra tokens after the string part",{toml:e,ptr:f});if(r<f&&(r=e.indexOf(t,f),r<0))throw new a("incomplete key-value: cannot find end of key",{toml:e,ptr:n});i.push(b(e,n,f))}else{l=e.indexOf(".",n);let f=e.slice(n,l<0||l>r?r:l);if(!F.test(f))throw new a("only letter, numbers, dashes and underscores are allowed in keys",{toml:e,ptr:n});i.push(f.trimEnd())}}while(l+1&&l<r);return[i,d(e,r+1,!0,!0)]}function $(e,n){let t={},l=new Set,i,r=0;for(n++;(i=e[n++])!=="}"&&i;){if(i===`
`)throw new a("newlines are not allowed in inline tables",{toml:e,ptr:n-1});if(i==="#")throw new a("inline tables cannot contain comments",{toml:e,ptr:n-1});if(i===",")throw new a("expected key-value, found comma",{toml:e,ptr:n-1});if(i!==" "&&i!=="	"){let o,f=t,u=!1,[c,s]=x(e,n-1);for(let p=0;p<c.length;p++){if(p&&(f=u?f[o]:f[o]={}),o=c[p],(u=Object.hasOwn(f,o))&&(typeof f[o]!="object"||l.has(f[o])))throw new a("trying to redefine an already defined value",{toml:e,ptr:n});!u&&o==="__proto__"&&Object.defineProperty(f,o,{enumerable:!0,configurable:!0,writable:!0})}if(u)throw new a("trying to redefine an already defined value",{toml:e,ptr:n});let[_,L]=g(e,s,"}");l.add(_),f[o]=_,n=L,r=e[n-1]===","?n-1:0}}if(r)throw new a("trailing commas are not allowed in inline tables",{toml:e,ptr:r});if(!i)throw new a("unfinished table encountered",{toml:e,ptr:n});return[t,n]}function N(e,n){let t=[],l;for(n++;(l=e[n++])!=="]"&&l;){if(l===",")throw new a("expected value, found comma",{toml:e,ptr:n-1});if(l==="#")n=h(e,n);else if(l!==" "&&l!=="	"&&l!==`
`&&l!=="\r"){let i=g(e,n-1,"]");t.push(i[0]),n=i[1]}}if(!l)throw new a("unfinished array encountered",{toml:e,ptr:n});return[t,n]}function D(e,n,t,l){let i=n,r=t,o,f=!1,u;for(let c=0;c<e.length;c++){if(c){if(i=f?i[o]:i[o]={},r=(u=r[o]).c,l===0&&(u.t===1||u.t===2))return null;if(u.t===2){let s=i.length-1;i=i[s],r=r[s].c}}if(o=e[c],(f=Object.hasOwn(i,o))&&r[o]?.t===0&&r[o]?.d)return null;f||(o==="__proto__"&&(Object.defineProperty(i,o,{enumerable:!0,configurable:!0,writable:!0}),Object.defineProperty(r,o,{enumerable:!0,configurable:!0,writable:!0})),r[o]={t:c<e.length-1&&l===2?3:l,d:!1,i:0,c:{}})}if(u=r[o],u.t!==l&&!(l===1&&u.t===3)||(l===2&&(u.d||(u.d=!0,i[o]=[]),i[o].push(i={}),u.c[u.i++]=u={t:1,d:!1,i:0,c:{}}),u.d))return null;if(u.d=!0,l===1)i=f?i[o]:i[o]={};else if(l===0&&f)return null;return[o,i,u.c]}function G(e){let n={},t={},l=n,i=t;for(let r=d(e,0);r<e.length;){if(e[r]==="["){let o=e[++r]==="[",f=x(e,r+=+o,"]");if(o){if(e[f[1]-1]!=="]")throw new a("expected end of table declaration",{toml:e,ptr:f[1]-1});f[1]++}let u=D(f[0],n,t,o?2:1);if(!u)throw new a("trying to redefine an already defined table or value",{toml:e,ptr:r});i=u[2],l=u[1],r=f[1]}else{let o=x(e,r),f=D(o[0],l,i,0);if(!f)throw new a("trying to redefine an already defined table or value",{toml:e,ptr:r});let u=g(e,o[1]);f[1][f[0]]=u[0],r=u[1]}if(r=d(e,r,!0),e[r]&&e[r]!==`
`&&e[r]!=="\r")throw new a("each key-value declaration must be followed by an end-of-line",{toml:e,ptr:r});r=d(e,r)}return n}var V=/^[a-z0-9-_]+$/i;function E(e){let n=typeof e;if(n==="object"){if(Array.isArray(e))return"array";if(e instanceof Date)return"date"}return n}function U(e){for(let n=0;n<e.length;n++)if(E(e[n])!=="object")return!1;return!0}function O(e){return JSON.stringify(e).replace(/\x7f/g,"\\u007f")}function S(e,n=E(e)){if(n==="number")return isNaN(e)?"nan":e===1/0?"inf":e===-1/0?"-inf":e.toString();if(n==="bigint"||n==="boolean")return e.toString();if(n==="string")return O(e);if(n==="date"){if(isNaN(e.getTime()))throw new TypeError("cannot serialize invalid date");return e.toISOString()}if(n==="object")return X(e);if(n==="array")return j(e)}function X(e){let n="{ ",t=Object.keys(e);for(let l=0;l<t.length;l++){let i=t[l];l&&(n+=", "),n+=V.test(i)?i:O(i),n+=" = ",n+=S(e[i])}return n+" }"}function j(e){let n="[ ";for(let t=0;t<e.length;t++){if(t&&(n+=", "),e[t]===null||e[t]===void 0)throw new TypeError("arrays cannot contain null or undefined values");n+=S(e[t])}return n+" ]"}function B(e,n){let t="";for(let l=0;l<e.length;l++)t+=`[[${n}]]
`,t+=A(e[l],n),t+=`

`;return t}function A(e,n=""){let t="",l="",i=Object.keys(e);for(let r=0;r<i.length;r++){let o=i[r];if(e[o]!==null&&e[o]!==void 0){let f=E(e[o]);if(f==="symbol"||f==="function")throw new TypeError(`cannot serialize values of type '${f}'`);let u=V.test(o)?o:O(o);if(f==="array"&&U(e[o]))l+=B(e[o],n?`${n}.${u}`:u);else if(f==="object"){let c=n?`${n}.${u}`:u;l+=`[${c}]
`,l+=A(e[o],c),l+=`

`}else t+=u,t+=" = ",t+=S(e[o],f),t+=`
`}}return`${t}
${l}`.trim()}function Y(e){if(E(e)!=="object")throw new TypeError("stringify can only be called with an object");return A(e)}export{m as TomlDate,a as TomlError,G as parse,Y as stringify};
/*! Bundled license information:

smol-toml/dist/error.js:
smol-toml/dist/date.js:
smol-toml/dist/util.js:
smol-toml/dist/primitive.js:
smol-toml/dist/extract.js:
smol-toml/dist/struct.js:
smol-toml/dist/parse.js:
smol-toml/dist/stringify.js:
smol-toml/dist/index.js:
  (*!
   * Copyright (c) Squirrel Chat et al., All rights reserved.
   * SPDX-License-Identifier: BSD-3-Clause
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice, this
   *    list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the
   *    documentation and/or other materials provided with the distribution.
   * 3. Neither the name of the copyright holder nor the names of its contributors
   *    may be used to endorse or promote products derived from this software without
   *    specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
   * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
   * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
   * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
   * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
   * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *)
*/
//# sourceMappingURL=smol-toml.mjs.map