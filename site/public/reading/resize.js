(() => {
  const report = () => parent.postMessage({type:'article-size',height:document.body.offsetHeight+24},location.origin);
  new ResizeObserver(report).observe(document.body);
  report();
})();
