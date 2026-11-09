import {fixtureDeck} from "../../packages/deck/src/fixture.ts"
import {id,type Element} from "../../packages/deck/src/model.ts"
export function investorDeck(deckId:string) {
  const deck={...fixtureDeck(0,8),id:id(deckId),template:{id:"halden",version:1,family:"basic"}}
  const base=(key:string,box:Element["box"])=>({id:id(key),box,source:{kind:"created"} as const,support:{kind:"native"} as const,theme:null,placeholder:null,overlap:null})
  const text=(key:string,value:string,x:number,y:number,width=800,height=65,size=36,color="#102633"):Element=>({...base(key,{x,y,width,height}),kind:"text",runs:[{text:value,font:"Geist",size,color,bold:true}]})
  const shape=(key:string,x:number,y:number,width:number,height:number,fill:string,geometry:"rectangle"|"ellipse"="rectangle"):Element=>({...base(key,{x,y,width,height}),kind:"shape",geometry,fill})
  const titles=["Q3 Investor Update","Three things to know","Enterprise drove two thirds of growth since FY21","71%","Customers","Product","Hiring plan","Next quarter"]
  for(const [index,slide] of deck.slides.entries()){
    slide.notes=index===2 ? "Sample data: enterprise grew from $0.9M in FY21 to $3.5M in FY25E. The full revenue series grows about 20% annually." : ""
    slide.elements=[text(`s${index}e0`,titles[index]!,72,70)]
    if(index===0||index===7)slide.elements=[shape(`s${index}background`,0,0,960,540,index===0 ? "#102633" : "#1e6f8c"),text(`s${index}e0`,titles[index]!,72,360,800,65,42,"#ffffff"),shape(`s${index}rule`,72,438,280,6,"#a9c6d3")]
    if(index===1)for(let n=0;n<3;n++)slide.elements.push(shape(`s${index}line${n}`,72,180+n*48,650-n*50,14,"#d4d4d4"))
    if(index===2){
      slide.elements=[text("s2e0",titles[2]!,44,36,870,54,26)]
      const values=[3,3.4,4.1,5,6.3],segments=[[.9,1.3,1.9,2.6,3.5],[1.2,1.2,1.3,1.4,1.6],[.9,.9,.9,1,1.2]],labels=["FY21","FY22","FY23","FY24","FY25E"]
      const colors=["#102633","#3173ca","#c9dcfa"]
      slide.elements.push(text("s2subtitle","Revenue by customer segment, FY21 to FY25E, $M",44,92,800,28,13,"#727272"))
      for(const [n,value] of values.entries()){
        const height=value*32,x=160+n*108,y=452-height
        let bottom=452
        for(const [segment,series] of segments.entries()){
          const segmentHeight=series[n]!*32
          bottom-=segmentHeight
          slide.elements.push(shape(`s2bar${n}part${segment}`,x,bottom,58,segmentHeight,colors[segment]!))
        }
        const growth=n===0 ? "—" : `${Math.round((value/values[n-1]!-1)*100)}%`
        slide.elements.push(text(`s2value${n}`,`$${value.toFixed(1)}M`,x,y-22,90,20,12),text(`s2label${n}`,labels[n]!,x,462,85,20,11,"#727272"),text(`s2growth${n}`,growth==="—"?growth:`+${growth}`,x,145,85,18,11,"#2a9b62"))
      }
      for(const [n,label] of ["Self-serve","Mid-market","Enterprise"].entries())slide.elements.push(text(`s2segment${n}`,label,44,325+n*43,110,22,11,"#727272"))
      for(let n=0;n<36;n++)slide.elements.push(shape(`s2trend${n}`,189+n*12,350-n*3,13,1,"#102633"))
      slide.elements.push(text("s2annotation","+20% CAGR",365,270,140,22,12),shape("s2divider",712,150,1,320,"#d4d4d4"),text("s2tabletitle","Growth by segment",732,145,200,22,12))
      for(let n=2;n<5;n++)slide.elements.push(text(`s2tableyear${n}`,labels[n]!,760+(n-2)*52,180,50,20,10,"#727272"))
      for(const [row,series] of segments.entries()){
        slide.elements.push(shape(`s2tablekey${row}`,732,216+row*76,3,48,colors[row]!))
        for(let n=2;n<5;n++){
          const growth=Math.round((series[n]!/series[n-1]!-1)*100)
          slide.elements.push(text(`s2table${row}value${n}`,`${growth>0?"+":""}${growth}%`,760+(n-2)*52,230+row*76,50,20,10))
        }
      }
      slide.elements.push(text("s2source","Source: synthetic Halden investor update. Sample data.",44,510,850,20,10,"#999999"))
    }
    if(index===3)slide.elements=[text("s3e0","71%",72,170,800,160,110,"#1e6f8c"),shape("s3rule",72,350,360,15,"#d4d4d4")]
    if(index===4)for(let n=0;n<6;n++)slide.elements.push(shape(`s4customer${n}`,72+n%3*255,170+Math.floor(n/3)*115,235,90,"#eaeae8"))
    if(index===5)slide.elements=[shape("s5background",0,0,960,540,"#a9c6d3"),text("s5e0","Product",72,70)]
    if(index===6)for(let n=0;n<4;n++)slide.elements.push(shape(`s6person${n}`,72+n*128,190,96,96,"#d4d4d4","ellipse"))
  }
  return deck
}
