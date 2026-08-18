export function injectTryItButtons(html: string): string {
  if (!html || !html.includes('playground-wrapper')) return html

  const injectedScript = `
<script>
(function() {

  function buildEditorPage(htmlCode, cssCode, jsCode, activeTab) {
    var editorHtml = [
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">',
      '<title>Try it Yourself<\/title>',
      '<style>',
      '*{margin:0;padding:0;box-sizing:border-box}',
      'body{height:100vh;font-family:"Segoe UI",sans-serif;background:#1e1e1e;overflow:hidden;display:flex;flex-direction:column}',
      '.toolbar{display:flex;align-items:center;gap:12px;padding:0 20px;background:#252526;border-bottom:2px solid #1a1a1a;height:52px;flex-shrink:0}',
      '.toolbar span{font-size:14px;font-weight:700;color:#fff}',
      '.run-btn{display:flex;align-items:center;gap:8px;padding:8px 24px;background:#04AA6D;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;margin-left:auto}',
      '.run-btn:hover{background:#028a57}',
      '.main{display:flex;flex:1;overflow:hidden}',
      '.editor-side{width:50%;display:flex;flex-direction:column;border-right:2px solid #1a1a1a}',
      '.tabs{display:flex;background:#252526;border-bottom:1px solid #1a1a1a;padding:0 8px;flex-shrink:0}',
      '.tab{padding:12px 20px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#858585;border-bottom:2px solid transparent}',
      '.tab.active{color:#fff;border-bottom-color:#04AA6D;background:#1e1e1e}',
      '.editor-area{flex:1;position:relative;overflow:hidden}',
      'textarea{position:absolute;inset:0;width:100%;height:100%;background:#1e1e1e;color:#d4d4d4;border:none;outline:none;padding:20px;font-family:Consolas,monospace;font-size:13px;line-height:1.6;resize:none}',
      '.preview-side{width:50%;display:flex;flex-direction:column;background:#fff}',
      '.preview-header{padding:10px 16px;background:#f3f3f3;border-bottom:1px solid #ddd;font-size:12px;font-weight:600;color:#666;flex-shrink:0}',
      '#preview{flex:1;border:none;width:100%}',
      '<\/style><\/head><body>',
      '<div class="toolbar">',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><polygon points="5,3 19,12 5,21"><\/polygon><\/svg>',
        '<span>Try it Yourself \u2014 Code Editor<\/span>',
        '<button class="run-btn" onclick="runCode()">&#9654; Run<\/button>',
      '<\/div>',
      '<div class="main">',
        '<div class="editor-side">',
          '<div class="tabs">',
            '<button class="tab" id="tab-html" onclick="switchTab(\'html\')">HTML<\/button>',
            '<button class="tab" id="tab-css"  onclick="switchTab(\'css\')">CSS<\/button>',
            '<button class="tab" id="tab-js"   onclick="switchTab(\'js\')">JavaScript<\/button>',
          '<\/div>',
          '<div class="editor-area">',
            '<textarea id="html-editor"><\/textarea>',
            '<textarea id="css-editor"  style="display:none"><\/textarea>',
            '<textarea id="js-editor"   style="display:none"><\/textarea>',
          '<\/div>',
        '<\/div>',
        '<div class="preview-side">',
          '<div class="preview-header">&#9654; Output<\/div>',
          '<iframe id="preview" sandbox="allow-same-origin allow-scripts allow-popups"><\/iframe>',
        '<\/div>',
      '<\/div>',
    ].join('')

    var initScript = '<scr' + 'ipt>' +
      'var H=' + JSON.stringify(htmlCode || '') + ',' +
      'C=' + JSON.stringify(cssCode || '') + ',' +
      'J=' + JSON.stringify(jsCode || '') + ',' +
      'T=' + JSON.stringify(activeTab || 'html') + ';' +
      'document.getElementById("html-editor").value=H;' +
      'document.getElementById("css-editor").value=C;' +
      'document.getElementById("js-editor").value=J;' +
      'function switchTab(t){' +
        '["html","css","js"].forEach(function(x){' +
          'var e=document.getElementById(x+"-editor");' +
          'var b=document.getElementById("tab-"+x);' +
          'if(e)e.style.display=x===t?"block":"none";' +
          'if(b){if(x===t)b.classList.add("active");else b.classList.remove("active");}' +
        '});' +
      '}' +
      'function combine(){' +
        'var h=document.getElementById("html-editor").value;' +
        'var c=document.getElementById("css-editor").value;' +
        'var j=document.getElementById("js-editor").value;' +
        'var f=h;' +
        'if(c&&c.trim()){' +
          'if(f.indexOf("<\/head>")!==-1)f=f.replace("<\/head>","<style>"+c+"<\/style><\/head>");' +
          'else f="<style>"+c+"<\/style>"+f;' +
        '}' +
        'if(j&&j.trim()){' +
          'if(f.indexOf("<\/body>")!==-1)f=f.replace("<\/body>","<scr"+"ipt>"+j+"<\/scr"+"ipt><\/body>");' +
          'else f=f+"<scr"+"ipt>"+j+"<\/scr"+"ipt>";' +
        '}' +
        'return f;' +
      '}' +
      'function runCode(){document.getElementById("preview").srcdoc=combine();}' +
      'document.querySelectorAll("textarea").forEach(function(ta){' +
        'ta.addEventListener("keydown",function(e){' +
          'if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();runCode();}' +
          'if(e.key==="Tab"){e.preventDefault();var s=ta.selectionStart;ta.value=ta.value.substring(0,s)+"  "+ta.value.substring(ta.selectionEnd);ta.selectionStart=ta.selectionEnd=s+2;}' +
        '});' +
      '});' +
      'switchTab(T);' +
      'window.onload=function(){runCode();};' +
    '<\/scr' + 'ipt><\/body><\/html>'

    return editorHtml + initScript
  }

  /* ── Decode HTML entities in srcdoc attribute using browser ── */
  function decodeSrcdoc(encoded) {
    if (!encoded) return ''
    var ta = document.createElement('textarea')
    ta.innerHTML = encoded
    return ta.value
  }

  /* ── Use DOMParser to extract HTML/CSS/JS — zero regex ── */
  function extractParts(fullHtml) {
    if (!fullHtml) return { html: '', css: '', js: '' }
    var parser = new DOMParser()
    var doc = parser.parseFromString(fullHtml, 'text/html')

    var cssCode = ''
    doc.querySelectorAll('style').forEach(function(el) {
      cssCode += el.textContent + '\n'
    })

    var jsCode = ''
    doc.querySelectorAll('script').forEach(function(el) {
      var c = el.textContent || ''
      if (c && c.indexOf('PAGE_IDS') === -1 && c.indexOf('showPage') === -1) {
        jsCode += c + '\n'
      }
    })

    doc.querySelectorAll('style, script').forEach(function(el) { el.remove() })
    var bodyHtml = doc.body ? doc.body.innerHTML.trim() : fullHtml

    return {
      html: bodyHtml || fullHtml,
      css: cssCode.trim(),
      js: jsCode.trim()
    }
  }

  /* ── Escape HTML for display in <code> block ── */
  function escapeHtml(str) {
    var d = document.createElement('div')
    d.appendChild(document.createTextNode(str))
    return d.innerHTML
  }

  /* ── Main ── */
  function processPlaygrounds() {
    var wrappers = document.querySelectorAll('.playground-wrapper')
    wrappers.forEach(function(wrapper, idx) {
      if (wrapper.getAttribute('data-tiy-done')) return
      wrapper.setAttribute('data-tiy-done', '1')

      var iframe = wrapper.querySelector('iframe[srcdoc]')
      if (!iframe) return

      var decoded = decodeSrcdoc(iframe.getAttribute('srcdoc') || '')
      var parts = extractParts(decoded)

      /* Determine which tab's code to display */
      var activeTab = wrapper.getAttribute('data-active-tab') ||
                      wrapper.getAttribute('data-primary-tab') || 'html'
      if (activeTab === 'auto') activeTab = 'html'

      /* Pick the code to show based on active tab */
      var displayCode = ''
      if (activeTab === 'css' && parts.css) displayCode = parts.css
      else if (activeTab === 'js' && parts.js) displayCode = parts.js
      else displayCode = parts.html

      /* If the chosen tab is empty, fall back */
      if (!displayCode.trim()) {
        if (parts.css) { displayCode = parts.css; activeTab = 'css' }
        else if (parts.html) { displayCode = parts.html; activeTab = 'html' }
        else if (parts.js) { displayCode = parts.js; activeTab = 'js' }
      }

      /* Language label + color */
      var langLabel = activeTab === 'css' ? 'CSS' : activeTab === 'js' ? 'JavaScript' : 'HTML'
      var langColor = activeTab === 'css' ? '#264de4' : activeTab === 'js' ? '#f0db4f' : '#e34c26'
      var langBg    = activeTab === 'css' ? 'rgba(38,77,228,0.12)' : activeTab === 'js' ? 'rgba(240,219,79,0.15)' : 'rgba(227,76,38,0.12)'

      /* Store data for the editor */
      if (!window._pgData) window._pgData = {}
      window._pgData[idx] = { html: parts.html, css: parts.css, js: parts.js, activeTab: activeTab }

      /* ── Build replacement: code block + button bar ── */
      var container = document.createElement('div')
      container.style.cssText = 'margin:1.5rem 0;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;font-family:Arial,sans-serif;'

      /* Top bar: traffic lights + language badge */
      var topBar = document.createElement('div')
      topBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;'
      topBar.innerHTML = [
        '<div style="display:flex;align-items:center;gap:6px;">',
          '<span style="width:10px;height:10px;border-radius:50%;background:#ff5f57;display:inline-block;"></span>',
          '<span style="width:10px;height:10px;border-radius:50%;background:#ffbd2e;display:inline-block;"></span>',
          '<span style="width:10px;height:10px;border-radius:50%;background:#28c840;display:inline-block;"></span>',
        '<\/div>',
        '<span style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:4px;background:' + langBg + ';color:' + langColor + ';">' + langLabel + '<\/span>',
      ].join('')

      /* Code area */
      var codeArea = document.createElement('div')
      codeArea.style.cssText = 'background:#1e1e1e;border-left:4px solid ' + langColor + ';overflow-x:auto;'
      codeArea.innerHTML = '<pre style="margin:0;padding:20px 24px;font-family:Consolas,\'Fira Code\',\'Courier New\',monospace;font-size:13.5px;line-height:1.8;color:#d4d4d4;white-space:pre;"><code>' + escapeHtml(displayCode) + '<\/code><\/pre>'

      /* Bottom bar: hint + Try it Yourself button */
      var bottomBar = document.createElement('div')
      bottomBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#f8fafc;border-top:1px solid #e2e8f0;'

      var hint = document.createElement('span')
      hint.style.cssText = 'font-size:12px;color:#64748b;'
      hint.textContent = 'Click the button to edit and run this example'

      var btn = document.createElement('button')
      btn.setAttribute('data-pgidx', String(idx))
      btn.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'gap:8px',
        'padding:9px 22px',
        'background:#04AA6D',
        'color:#fff',
        'border:none',
        'border-radius:6px',
        'font-size:13px',
        'font-weight:700',
        'cursor:pointer',
        'letter-spacing:.3px',
      ].join(';')
      btn.innerHTML = [
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="white" style="flex-shrink:0">',
          '<polygon points="5,3 19,12 5,21"><\/polygon>',
        '<\/svg>',
        'Try it Yourself \u00bb',
      ].join('')

      btn.addEventListener('mouseover', function() { btn.style.background = '#028a57' })
      btn.addEventListener('mouseout',  function() { btn.style.background = '#04AA6D' })
      btn.addEventListener('click', function() {
        var i = parseInt(btn.getAttribute('data-pgidx') || '0')
        var data = window._pgData && window._pgData[i]
        if (!data) return
        var page = buildEditorPage(data.html, data.css, data.js, data.activeTab)
        var w = window.open('', '_blank')
        if (!w) { alert('Popup blocked \u2014 please allow popups.'); return }
        w.document.write(page)
        w.document.close()
      })

      bottomBar.appendChild(hint)
      bottomBar.appendChild(btn)

      container.appendChild(topBar)
      container.appendChild(codeArea)
      container.appendChild(bottomBar)

      /* Replace the original playground-wrapper with our new container */
      wrapper.parentNode.replaceChild(container, wrapper)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processPlaygrounds)
  } else {
    processPlaygrounds()
  }

})();
<\/script>
`

  if (html.includes('</body>')) {
    return html.replace('</body>', injectedScript + '</body>')
  }
  return html + injectedScript
}

export default injectTryItButtons