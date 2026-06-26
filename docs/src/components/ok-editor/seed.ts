const HERO_INTRO = `# Launch week recap

v2.0 went public on June 3 — the end of a quiet QA window and the start of launch week.

47 PRs merged across the cycle. Activity stayed close to zero through QA, then spiked on launch day as the announcement went live.`;

const HERO_TASKS = [
  '- [ ] Shipped v2.0 to public on Jun 3',
  '- [ ] 1.4k new signups in the first 24 hours',
  '- [ ] Hit #1 on Product Hunt and front of Hacker News',
];

export const HERO_FRONTMATTER = {
  title: 'Launch week recap',
  tags: ['launch', 'retro', 'v2'],
} as const;

export const HERO_FRONTMATTER_YAML = [
  '---',
  `title: ${HERO_FRONTMATTER.title}`,
  'tags:',
  ...HERO_FRONTMATTER.tags.map((t) => `  - ${t}`),
  '---',
].join('\n');

const HERO_CHART_HTML = `<div style="font-family:system-ui,-apple-system,sans-serif;height:100%;box-sizing:border-box;display:flex;flex-direction:column;padding:13px 16px 11px;color:var(--foreground)">
  <div style="flex:none;font-size:15px;font-weight:500;margin-bottom:16px">PRs merged per day · last 30 days</div>
  <div id="plot" style="position:relative;flex:1 1 auto;min-height:0" aria-label="Daily PRs merged, peaking on launch day"></div>
  <script>
    var data=[11,4,1,0.5,0,0,0,0,0,0,0,0,0,0,0,2,0.5,0,0,0,0,1,1.2,1,24,8,1,0.2,0,0.5,0];
    var max=24,n=data.length,PADL=26,PADR=6,PADT=6,PADB=18;
    var xN=function(i){return (i/(n-1)*1000).toFixed(1);};
    var yN=function(v){return ((1-v/max)*1000).toFixed(1);};
    var base=1000,pts=data.map(function(v,i){return {x:+xN(i),y:+yN(v)};});
    var line='M '+pts[0].x+' '+pts[0].y;
    for(var i=0;i<pts.length-1;i++){
      var p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
      var c1x=p1.x+(p2.x-p0.x)/6,c2x=p2.x-(p3.x-p1.x)/6;
      var c1y=Math.min(base,p1.y+(p2.y-p0.y)/6),c2y=Math.min(base,p2.y-(p3.y-p1.y)/6);
      line+=' C '+c1x.toFixed(1)+' '+c1y.toFixed(1)+', '+c2x.toFixed(1)+' '+c2y.toFixed(1)+', '+p2.x+' '+p2.y;
    }
    var area=line+' L '+pts[n-1].x+' '+base+' L '+pts[0].x+' '+base+' Z';
    var ticks=[0,6,12,18,24];
    var grid=ticks.map(function(t){return '<line x1="0" x2="1000" y1="'+yN(t)+'" y2="'+yN(t)+'" vector-effect="non-scaling-stroke" style="stroke:color-mix(in srgb, var(--border) 65%, transparent)" stroke-width="1"/>';}).join('');
    var svg='<div style="position:absolute;left:'+PADL+'px;right:'+PADR+'px;top:'+PADT+'px;bottom:'+PADB+'px"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style="display:block;width:100%;height:100%;overflow:visible">'
      +'<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style="stop-color:var(--primary);stop-opacity:0.16"/><stop offset="100%" style="stop-color:var(--primary);stop-opacity:0.015"/></linearGradient></defs>'
      +grid+'<path d="'+area+'" style="fill:url(#g)"/>'
      +'<path d="'+line+'" vector-effect="non-scaling-stroke" style="fill:none;stroke:color-mix(in oklab, var(--primary) 78%, white);stroke-width:1.5;stroke-linejoin:round;stroke-linecap:round"/></svg></div>';
    var ylab=ticks.map(function(t){var top='calc('+PADT+'px + '+(1-t/max).toFixed(4)+' * (100% - '+(PADT+PADB)+'px))';return '<div style="position:absolute;left:0;top:'+top+';width:'+(PADL-8)+'px;text-align:right;transform:translateY(-50%);font-size:10px;line-height:1;color:var(--muted-foreground)">'+t+'</div>';}).join('');
    var xlab=[[0,'May 10'],[15,'May 25'],[30,'Jun 9']].map(function(d){var left='calc('+PADL+'px + '+(d[0]/(n-1)).toFixed(4)+' * (100% - '+(PADL+PADR)+'px))';return '<div style="position:absolute;bottom:0;left:'+left+';transform:translateX(-50%);font-size:10px;line-height:1;white-space:nowrap;color:var(--muted-foreground)">'+d[1]+'</div>';}).join('');
    document.getElementById('plot').innerHTML=svg+ylab+xlab;
  </script>
</div>`;

export function heroRevealMarkdown(step: number): string {
  let md = HERO_INTRO;
  if (step >= 1) md += '\n\n## Highlights';
  const tasks = step <= 1 ? 0 : Math.min(HERO_TASKS.length, step - 1);
  if (tasks > 0) md += `\n\n${HERO_TASKS.slice(0, tasks).join('\n')}`;
  if (step >= 5) md += `\n\n\`\`\`html preview h=224\n${HERO_CHART_HTML}\n\`\`\``;
  return md;
}

export const HERO_SEED_MARKDOWN = heroRevealMarkdown(5);
