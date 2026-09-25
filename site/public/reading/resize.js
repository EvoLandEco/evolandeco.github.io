(() => {
  const report = () => parent.postMessage({type:'article-size',height:Math.ceil(document.body.getBoundingClientRect().height)},location.origin);
  new ResizeObserver(report).observe(document.body);
  report();
})();
