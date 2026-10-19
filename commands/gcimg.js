"use strict";

const Canvas=require("canvas");
const axios=require("axios");
const fs=require("fs-extra");
const path=require("path");

const W=1800,H=1150,CACHE=path.join(__dirname,"cache");
fs.ensureDirSync(CACHE);

try{
	Canvas.registerFont(`${__dirname}/assets/font/BeVietnamPro-SemiBold.ttf`,{family:"BeVietnam"});
	Canvas.registerFont(`${__dirname}/assets/font/BeVietnamPro-Bold.ttf`,{family:"BeVietnamBold"});
}catch{}

const cache=new Map();

async function getImage(url){
	if(!url)return null;
	if(cache.has(url))return cache.get(url);
	try{
		const r=await axios.get(url,{
			responseType:"arraybuffer",timeout:15000,
			headers:{"User-Agent":"Mozilla/5.0","Accept":"image/*"},
			maxContentLength:8*1024*1024
		});
		const img=await Canvas.loadImage(Buffer.from(r.data));
		cache.set(url,img);return img;
	}catch{return null}
}

function round(c,x,y,w,h,r){
	c.beginPath();c.moveTo(x+r,y);
	c.arcTo(x+w,y,x+w,y+h,r);
	c.arcTo(x+w,y+h,x,y+h,r);
	c.arcTo(x,y+h,x,y,r);
	c.arcTo(x,y,x+w,y,r);c.closePath();
}

function avatar(c,img,x,y,r){
	c.save();c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.clip();
	if(img)c.drawImage(img,x-r,y-r,r*2,r*2);
	else{
		c.fillStyle="#111a1d";c.fill();
		c.fillStyle="#fff";c.font=`bold ${Math.max(18,r*.55)}px BeVietnamBold`;
		c.textAlign="center";c.textBaseline="middle";c.fillText("?",x,y);
	}
	c.restore();
}

function fit(c,name,max,maxF,min=8){
	name=String(name||"Unknown").trim();
	for(let s=maxF;s>=min;s--){
		c.font=`bold ${s}px BeVietnamBold`;
		if(c.measureText(name).width<=max)return name;
	}
	c.font=`bold ${min}px BeVietnamBold`;
	let o="";
	for(const ch of name){
		if(c.measureText(o+ch+"…").width>max)break;
		o+=ch;
	}
	return o+"…";
}

async function userImg(api,ud,uid){
	try{
		const i=await getImage(await ud.getAvatarUrl(uid));
		if(i)return i;
	}catch{}
	try{
		const d=await new Promise((res,rej)=>api.getUserInfo(uid,(e,r)=>e?rej(e):res(r)));
		return getImage(d?.[uid]?.thumbSrc);
	}catch{return null}
}

async function buildCard(api,ud,threadID){
	const info=await api.getThreadInfo(threadID);
	const ids=info.participantIDs||[];
	const adminsID=new Set((info.adminIDs||[]).map(String));

	const users=await Promise.all(ids.map(async uid=>{
		let name="Unknown";
		try{name=(await ud.get(uid))?.name||name}catch{}
		if(name==="Unknown")try{
			const d=await new Promise((res,rej)=>api.getUserInfo(uid,(e,r)=>e?rej(e):res(r)));
			name=d?.[uid]?.name||name;
		}catch{}
		return{id:String(uid),name:String(name).trim()||"Unknown",admin:adminsID.has(String(uid))};
	}));

	const admins=users.filter(x=>x.admin),members=users.filter(x=>!x.admin);
	const [adminImgs,memberImgs]=await Promise.all([
		Promise.all(admins.map(x=>userImg(api,ud,x.id))),
		Promise.all(members.map(x=>userImg(api,ud,x.id)))
	]);

	const c=Canvas.createCanvas(W,H),ctx=c.getContext("2d");
	const G="#7CFF6B",CY="#3CF4FF",GD="#FFD66B",WH="#FFF";

	/* BACKGROUND */
	const bg=ctx.createLinearGradient(0,0,W,H);
	bg.addColorStop(0,"#02090B");bg.addColorStop(.45,"#041719");bg.addColorStop(1,"#071128");
	ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

	for(const [x,y,r,col] of [
		[280,180,700,"rgba(24,230,138,.18)"],
		[1550,230,650,"rgba(60,244,255,.14)"]
	]){
		const g=ctx.createRadialGradient(x,y,10,x,y,r);
		g.addColorStop(0,col);g.addColorStop(.5,col.replace(".18",".05").replace(".14",".04"));
		g.addColorStop(1,"rgba(0,0,0,0)");
		ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
	}

	/* FRAME */
	ctx.save();ctx.shadowColor="rgba(60,244,255,.35)";ctx.shadowBlur=28;
	ctx.strokeStyle="rgba(60,244,255,.65)";ctx.lineWidth=3;
	round(ctx,18,18,W-36,H-36,34);ctx.stroke();ctx.restore();
	ctx.strokeStyle="rgba(255,214,107,.25)";ctx.lineWidth=1;
	round(ctx,28,28,W-56,H-56,28);ctx.stroke();

	/* GROUP */
	const gx=155,gy=150;
	const gi=await getImage(info.imageSrc||info.imageUrl);

	ctx.save();ctx.shadowColor="rgba(124,255,107,.95)";ctx.shadowBlur=38;
	ctx.strokeStyle=G;ctx.lineWidth=5;ctx.beginPath();ctx.arc(gx,gy,88,0,Math.PI*2);ctx.stroke();ctx.restore();

	ctx.strokeStyle="rgba(60,244,255,.75)";ctx.lineWidth=2;
	ctx.beginPath();ctx.arc(gx,gy,98,0,Math.PI*2);ctx.stroke();
	avatar(ctx,gi,gx,gy,80);

	let gn=info.threadName||"Group Chat";
	ctx.textAlign="left";ctx.font="bold 46px BeVietnamBold";
	if(ctx.measureText(gn).width>620)gn=fit(ctx,gn,620,46,28);
	ctx.fillStyle=WH;ctx.fillText(gn,280,135);
	ctx.fillStyle=G;ctx.font="bold 21px BeVietnamBold";
	ctx.fillText(`${users.length} MEMBERS  •  ${admins.length} ADMINS`,280,178);
	ctx.fillStyle="rgba(60,244,255,.60)";ctx.font="bold 13px BeVietnamBold";
	ctx.fillText("GROUP COMMUNITY",280,211);

	/* ADMIN PANEL */
	const px=900,py=50,pw=820,ph=255;
	ctx.fillStyle="rgba(255,255,255,.035)";round(ctx,px,py,pw,ph,28);ctx.fill();
	ctx.strokeStyle="rgba(255,214,107,.34)";ctx.lineWidth=2;ctx.stroke();

	ctx.fillStyle=GD;ctx.textAlign="center";ctx.font="bold 25px BeVietnamBold";
	ctx.fillText(`ADMIN  •  ${admins.length}`,px+pw/2,py+38);

	if(admins.length){
		const cols=admins.length<=3?admins.length:6,rows=Math.ceil(admins.length/cols);
		const top=py+62,bottom=py+ph-10,rowH=(bottom-top)/rows;
		const gapX=Math.min(175,(pw-70)/cols);
		const startX=px+pw/2-(cols-1)*gapX/2;

		for(let i=0;i<admins.length;i++){
			const u=admins[i],col=i%cols,row=Math.floor(i/cols);
			const x=startX+col*gapX,y=top+row*rowH+rowH/2;
			let r=admins.length<=3?52:admins.length<=6?42:admins.length<=12?31:24;
			r=Math.max(18,Math.min(r,rowH*.30,gapX*.30));

			ctx.save();ctx.shadowColor="rgba(255,214,107,.85)";ctx.shadowBlur=20;
			ctx.strokeStyle=GD;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,r+4,0,Math.PI*2);ctx.stroke();ctx.restore();
			avatar(ctx,adminImgs[i],x,y,r);

			const nf=r>=45?14:r>=35?13:r>=27?11:9;
			ctx.fillStyle=WH;ctx.textAlign="center";ctx.font=`bold ${nf}px BeVietnamBold`;
			ctx.fillText(fit(ctx,u.name,Math.max(55,gapX-8),nf,7),x,y+r+19);
		}
	}

	/* DIVIDER */
	ctx.save();ctx.shadowColor="rgba(60,244,255,.55)";ctx.shadowBlur=12;
	ctx.strokeStyle="rgba(60,244,255,.55)";ctx.lineWidth=2;
	ctx.beginPath();ctx.moveTo(75,320);ctx.lineTo(W-75,320);ctx.stroke();ctx.restore();

	/* MEMBER TITLE */
	ctx.textAlign="left";ctx.fillStyle=WH;ctx.font="bold 25px BeVietnamBold";
	ctx.fillText(`GROUP MEMBERS  •  ${members.length}`,85,370);
	ctx.textAlign="right";ctx.fillStyle="rgba(124,255,107,.65)";ctx.font="bold 13px BeVietnamBold";
	ctx.fillText("COMMUNITY MEMBERS",W-85,370);

	/* MEMBERS */
	const n=members.length;
	const cols=n<=1?1:n<=2?2:n<=5?n:n<=10?5:n<=18?6:n<=32?8:n<=50?10:12;
	const rows=Math.max(1,Math.ceil(Math.max(n,1)/cols));
	const gl=70,gr=W-70,gt=420,gb=1010;
	const cw=(gr-gl)/cols,ch=(gb-gt)/rows;

	for(let i=0;i<n;i++){
		const u=members[i],col=i%cols,row=Math.floor(i/cols);
		const x=gl+cw*col+cw/2,y=gt+ch*row+ch/2;

		let r=n<=1?92:n<=2?82:n<=5?62:n<=10?54:n<=18?46:n<=32?38:n<=50?31:25;
		r=Math.max(17,Math.min(r,ch*.31,cw*.22));

		const tw=Math.max(70,cw-(n<=10?18:12));
		const th=Math.max(78,ch-(n<=10?14:10));

		ctx.fillStyle="rgba(255,255,255,.030)";
		round(ctx,x-tw/2,y-th/2,tw,th,18);ctx.fill();
		ctx.strokeStyle="rgba(60,244,255,.14)";ctx.lineWidth=1.2;ctx.stroke();

		ctx.save();ctx.shadowColor="rgba(124,255,107,.82)";ctx.shadowBlur=n<=10?22:16;
		ctx.strokeStyle=G;ctx.lineWidth=n<=10?3:2.5;
		ctx.beginPath();ctx.arc(x,y-8,r+4,0,Math.PI*2);ctx.stroke();ctx.restore();

		avatar(ctx,memberImgs[i],x,y-8,r);

		let nf=n<=1?25:n<=2?23:n<=5?20:n<=10?18:n<=18?16:n<=32?14:n<=50?12:11;
		nf=Math.min(nf,Math.max(9,ch*.14));

		ctx.fillStyle=WH;ctx.textAlign="center";ctx.font=`bold ${nf}px BeVietnamBold`;
		ctx.fillText(fit(ctx,u.name,Math.max(50,tw-18),nf,8),x,y+r+21);
	}

	/* FOOTER */
	ctx.strokeStyle="rgba(60,244,255,.18)";ctx.lineWidth=1;
	ctx.beginPath();ctx.moveTo(75,1060);ctx.lineTo(W-75,1060);ctx.stroke();

	ctx.textAlign="left";ctx.fillStyle="rgba(124,255,107,.58)";
	ctx.font="bold 12px BeVietnamBold";ctx.fillText("GROUP COMMUNITY",80,1087);

	ctx.textAlign="right";ctx.fillStyle="rgba(124,255,107,.58)";
	ctx.font="bold 12px BeVietnamBold";ctx.fillText("Powered By Tanvir143",W-80,1087);

	return c.toBuffer("image/png");
}

module.exports={
	config:{
		name: "gcimg",
		aliases: ["groupimage","groupcard","gc"],
		version: "13.0.0",
		author: "Tanvir143",
		cooldown: 5,
    role: 0,
    category: "users Cmd",
		shortDescription: "Premium dynamic group card made by tanvir143",
		longDescription: "Shows group DP, name, admins and members with dynamic sizing.",
		guide:{en: "{pn}"}
	},

	onStart:async function({message,event,api,usersData}){
		try{
			const buf=await buildCard(api,usersData,event.threadID);
			const file=path.join(CACHE,`gcimg_${event.threadID}_${Date.now()}.png`);
			await fs.writeFile(file,buf);

			return message.reply(
				{attachment:fs.createReadStream(file)},
				()=>setTimeout(()=>fs.remove(file).catch(()=>{}),30000)
			);
		}catch(e){
			console.error("GCIMG ERROR:",e);
			return message.reply("❌ Group card তৈরি করা যায়নি। আবার চেষ্টা করুন।");
		}
	}
};
