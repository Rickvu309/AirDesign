import {fixtureDeck} from "../../packages/deck/src/fixture.ts"
import {id,type Element} from "../../packages/deck/src/model.ts"
export function investorDeck(deckId:string) {
  const deck={...fixtureDeck(0,8),id:id(deckId),template:{id:"halden",version:1,family:"basic"}}
  const base=(key:string,box:Element["box"])=>({id:id(key),box,source:{kind:"created"} as const,support:{kind:"native"} as const,theme:null,placeholder:null,overlap:null})
  const text=(key:string,value:string,x:number,y:number,width=800,height=65,size=36,color="#102633"):Element=>({...base(key,{x,y,width,height}),kind:"text",runs:[{text:value,font:"Geist",size,color,bold:true}]})
  const shape=(key:string,x:number,y:number,width:number,height:number,fill:string,geometry:"rectangle"|"ellipse"="rectangle"):Element=>({...base(key,{x,y,width,height}),kind:"shape",geometry,fill})
  const titles=["Q3 Investor Update","Three things to know","Enterprise drove two thirds of growth since FY21","71%","Customers","Product","Hiring plan","Next quarter"]
  for(const [index,slide] of deck.slides.entries()){
    slide.notes=index===2 ? "Lead with the trend, then the Q3 number. Mention the two enterprise deals." : ""
    slide.elements=[text(`s${index}e0`,titles[index]!,72,70)]
    if(index===0||index===7)slide.elements=[shape(`s${index}background`,0,0,960,540,index===0 ? "#102633" : "#1e6f8c"),text(`s${index}e0`,titles[index]!,72,360,800,65,42,"#ffffff"),shape(`s${index}rule`,72,438,280,6,"#a9c6d3")]
    if(index===1)for(let n=0;n<3;n++)slide.elements.push(shape(`s${index}line${n}`,72,180+n*48,650-n*50,14,"#d4d4d4"))
    if(index===2){
      slide.elements=[text("s2eyebrow","REVENUE",72,60,800,32,14,"#1e6f8c"),text("s2e0",titles[2]!,72,100,820,80,30)]
      const values=[3,3.4,4.1,5,6.3],segments=[[.9,1.3,1.9,2.6,3.5],[1.2,1.2,1.3,1.4,1.6],[.9,.9,.9,1,1.2]],labels=["FY21","FY22","FY23","FY24","FY25E"]
      const colors=["#102633","#3173ca","#c9dcfa"]
      slide.elements.push(text("s2subtitle","Revenue by customer segment, FY21 to FY25E, $M",72,185,820,28,15,"#727272"))
      for(const [n,value] of values.entries()){
        const height=value*32,x=190+n*112,y=452-height
        let bottom=452
        for(const [segment,series] of segments.entries()){
          const segmentHeight=series[n]!*32
          bottom-=segmentHeight
          slide.elements.push(shape(`s2bar${n}part${segment}`,x,bottom,76,segmentHeight,colors[segment]!))
        }
        slide.elements.push(text(`s2value${n}`,`$${value.toFixed(1)}M`,x,y-18,100,22,14),text(`s2label${n}`,labels[n]!,x,462,100,22,12,"#727272"),text(`s2growth${n}`,["−4%","+13%","+21%","+22%","+26%"][n]!,x,210,100,16,12,"#2a9b62"))
      }
      for(const [n,label] of ["Self-serve","Mid-market","Enterprise"].entries())slide.elements.push(text(`s2segment${n}`,label,52,325+n*43,130,22,12,"#727272"))
      slide.elements.push(text("s2annotation","+20% CAGR",405,245,170,25,15),text("s2source","Source: synthetic Halden investor update. Sample data.",40,510,850,20,11,"#999999"))
    }
    if(index===3)slide.elements=[text("s3e0","71%",72,170,800,160,110,"#1e6f8c"),shape("s3rule",72,350,360,15,"#d4d4d4")]
    if(index===4)for(let n=0;n<6;n++)slide.elements.push(shape(`s4customer${n}`,72+n%3*255,170+Math.floor(n/3)*115,235,90,"#eaeae8"))
    if(index===5)slide.elements=[shape("s5background",0,0,960,540,"#a9c6d3"),text("s5e0","Product",72,70)]
    if(index===6)for(let n=0;n<4;n++)slide.elements.push(shape(`s6person${n}`,72+n*128,190,96,96,"#d4d4d4","ellipse"))
  }
  return deck
}
