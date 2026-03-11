//该例程实现插入数据，修改数据，删除数据，数据查询等基本操作。
//引入dmdb包
var db = require('dmdb');
var fs = require('fs');
var pool, conn;
async function example() {
	try {
		pool = await createPool();
		conn = await getConnection();
		await queryWithResultSet();
		await insertTable();
		await updateTable();
		await queryTable();
		await deleteTable();
		await queryWithResultSet();
	} catch (err) {
		console.log(err);
	} finally {
		try {
			await conn.close();
			await pool.close();
		} catch (err) {}
	}
}
example();

//创建连接池
async function createPool() {
	try {
		return db.createPool({
		connectString: "dm://SYSDBA:SYSDBA@dd&autoCommit=false",
		poolMax: 10,
		poolMin: 1
	});
  } catch (err) {
		throw new Error("createPool error: " + err.message);
	}
}
// 
//获取数据库连接
async function getConnection() {
	try {
		return pool.getConnection();
	} catch (err) {
		throw new Error("getConnection error: " + err.message);
	}
}

//往产品信息表插入数据 
async function insertTable() {
	try {
		var sql = "INSERT INTO production.product(name,author,publisher,publishtime,"
+
"product_subcategoryid,productno,satetystocklevel,originalprice,nowprice,discount,"
+ "description,photo,type,papertotal,wordtotal,sellstarttime,sellendtime) "
+ "VALUES(:1,:2,:3,:4,:5,:6,:7,:8,:9,:10,:11,:12,:13,:14,:15,:16,:17);";
		console.log("开始插入数据！");
	var blob = fs.createReadStream("/DM_INSTALL/三国演义.jpg");
		await conn.execute(
			sql,
			[
				{ val: "三国演义" },
				{ val: "罗贯中" },
				{ val: "中华书局" },
				{ val: new Date("2005-04-01") },
				{ val: 4 },
				{ val: "9787101046121" },
				{ val: 10 },
				{ val: 19.0000 },
				{ val: 15.2000 },
				{ val: 8.0 },
				{ val:"《三国演义》是中国第一部长篇章回体小说，中国小说由短篇发展至长篇的原因与说书有关。"},
				{ val: blob },
				{ val: "25" },
				{ val: 943 },
				{ val: 93000 },
				{ val: new Date("2006-03-20") },
				{ val: new Date("1900-01-01") }
			]
		);
		conn.execute("commit;");
		console.log("插入数据结束！");
	} catch (err) {
		throw new Error("insertTable error: " + err.message);
	}
}

//修改产品信息表数据
async function updateTable() {
	try {
		console.log("更新数据！")
		var sql = "UPDATE production.product SET name = :name " + "WHERE productid = 6;";
		// 按名称绑定变量
		await conn.execute(sql, { name: { val: "三国演义(上) " } });
		await conn.execute("commit;");
	} catch (err) {
		throw new Error("updateTable error: " + err.message);
	}
}

//删除产品信息表数据
async function deleteTable() {
	try {
		console.log("删除数据！")
		var sql = "DELETE FROM production.product WHERE productid = 11;"
		await conn.execute(sql);
		await conn.execute("commit;");
	} catch (err) {
		throw new Error("deleteTable error: " + err.message);
	}
}

//查询产品信息表
async function queryTable() {
	try {
		var sql = "SELECT productid,name,author,publisher,photo FROM production.product"
		var result = await conn.execute(sql);
		var lob = result.rows[result.rows.length - 1][4];
		var buffer = await readLob(lob);
		// Lob对象使用完需关闭
		await lob.close();
		console.log(buffer);
		return result;
	} catch (err) {
		throw new Error("queryTable error: " + err.message);
	}
}
//读取数据库返回的Lob对象
function readLob(lob) {
	return new Promise(function (resolve, reject) {
		var blobData = Buffer.alloc(0);
		var totalLength = 0;
		lob.on('data', function (chunk) {
			totalLength += chunk.length;
			blobData = Buffer.concat([blobData, chunk], totalLength);
		});
		lob.on('error', function (err) {
			reject(err);
		});
		lob.on('end', function () {
			resolve(blobData);
		});
	});
}
//结果集方式查询产品信息表
async function queryWithResultSet() {
	try {
		var sql = "SELECT productid,name,author,publisher FROM production.product";
		var result = await conn.execute(sql, [], { resultSet: true });
		var resultSet = result.resultSet;
		// 从结果集中获取一行
		result = await resultSet.getRow();
		while (result) {
			console.log(result);
			result = await resultSet.getRow();
		}
	} catch (err) {
		throw new Error("queryWithResultSet error: " + err.message);
	}
}
