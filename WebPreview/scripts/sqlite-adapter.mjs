import {DatabaseSync} from 'node:sqlite';
export class LocalD1 {
  constructor(filename=':memory:'){this.db=new DatabaseSync(filename);}
  withSession(){return this;}
  exec(sql){this.db.exec(sql);}
  prepare(sql){
    const statement=this.db.prepare(sql);let args=[];
    const wrapper={bind(...values){args=values;return wrapper;},async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};},async run(){const result=statement.run(...args);return {success:true,meta:{changes:Number(result.changes)}};}};
    return wrapper;
  }
  close(){this.db.close();}
}
