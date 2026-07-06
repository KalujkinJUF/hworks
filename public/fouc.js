(function() {
    const theme = localStorage.getItem('theme') || 'default';
    document.write('<link rel="stylesheet" id="theme-stylesheet" href="' + theme + '.css">');
})();
