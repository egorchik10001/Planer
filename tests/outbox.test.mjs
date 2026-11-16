import test from 'node:test';
import assert from 'node:assert/strict';
import {readOutbox,appendOutbox,removeOutbox} from '../lib/outbox.ts';
class Storage { data=new Map(); get length(){return this.data.size;} key(i){return [...this.data.keys()][i]??null;} getItem(k){return this.data.get(k)??null;} setItem(k,v){this.data.set(k,v);} removeItem(k){this.data.delete(k);} }
test('independent offline tabs cannot overwrite pending operations',()=>{const store=new Storage(),a={opId:'a',id:'first',changes:{title:'Из первой вкладки'}},b={opId:'b',id:'second',changes:{title:'Из второй вкладки'}};appendOutbox(store,'owner',a);appendOutbox(store,'owner',b);assert.equal(readOutbox(store,'owner').length,2);removeOutbox(store,'owner',['a']);assert.deepEqual(readOutbox(store,'owner'),[b]);});
test('an acknowledgement only removes its own operation and owner',()=>{const store=new Storage();appendOutbox(store,'one',{opId:'a'});appendOutbox(store,'two',{opId:'a'});removeOutbox(store,'one',['a']);assert.equal(readOutbox(store,'one').length,0);assert.equal(readOutbox(store,'two').length,1);});
