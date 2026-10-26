/**
 * Parser Markdown ke HTML Statis Ringan & Aman (Cloudflare Workers Native)
 * Dirancang khusus untuk dokumen legal (Terms of Service, Privacy Policy)
 * Menghasilkan HTML semantik, Table of Contents (Daftar Isi), Anchor Slug, & Meta Excerpt.
 */

export interface TocItem {
  id: string
  title: string
  level: number
}

export interface MarkdownParseResult {
  html: string
  toc: TocItem[]
  title: string
  excerpt: string
}

export const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const slugify = (text: string, existingSlugs: Set<string>): string => {
  let base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  if (!base) base = 'section'

  let slug = base
  let counter = 1
  while (existingSlugs.has(slug)) {
    counter++
    slug = `${base}-${counter}`
  }
  existingSlugs.add(slug)
  return slug
}

const parseInline = (text: string): string => {
  // 1. Escape HTML terlebih dahulu untuk mencegah XSS
  let escaped = escapeHtml(text)

  // 2. Inline Code: `code`
  escaped = escaped.replace(/`([^`]+)`/g, '<code class="legal-code">$1</code>')

  // 3. Bold: **text** atau __text__
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  escaped = escaped.replace(/__([^_]+)__/g, '<strong>$1</strong>')

  // 4. Italic: *text* atau _text_
  escaped = escaped.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3')
  escaped = escaped.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<em>$2</em>$3')

  // 5. Links: [Label](url)
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const trimmedUrl = url.trim()
    // Validasi URL aman (hanya http, https, mailto, tel, relative, atau hash)
    const isSafe = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(trimmedUrl)
    const safeUrl = isSafe ? trimmedUrl : '#'
    const isExternal = /^https?:\/\//i.test(safeUrl)
    const targetAttrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
    return `<a href="${safeUrl}" class="legal-link"${targetAttrs}>${label}</a>`
  })

  // 6. Line break manual jika ada dua spasi di ujung baris
  escaped = escaped.replace(/ {2,}\n/g, '<br />')

  return escaped
}

export function parseMarkdownToHtml(markdown: string): MarkdownParseResult {
  const lines = markdown.split(/\r?\n/)
  const toc: TocItem[] = []
  const usedSlugs = new Set<string>()

  let docTitle = ''
  let excerpt = ''
  const htmlParts: string[] = []

  let i = 0
  const len = lines.length

  while (i < len) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    // Baris kosong
    if (!trimmed) {
      i++
      continue
    }

    // 1. Horizontal Rule: --- atau *** atau ___
    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
      htmlParts.push('<hr class="legal-divider" />')
      i++
      continue
    }

    // 2. Headings: #, ##, ###, ####
    const headingMatch = rawLine.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const headingText = headingMatch[2].trim()
      const cleanText = headingText.replace(/\*\*|\*|`|_/g, '').trim()

      if (level === 1 && !docTitle) {
        docTitle = cleanText
      }

      const id = slugify(cleanText, usedSlugs)
      
      // Simpan ke Table of Contents (H1, H2, H3)
      if (level >= 1 && level <= 3) {
        toc.push({ id, title: cleanText, level })
      }

      const parsedTitle = parseInline(headingText)
      htmlParts.push(
        `<h${level} id="${id}" class="legal-heading legal-h${level}">` +
        `<span>${parsedTitle}</span>` +
        `<a href="#${id}" class="anchor-link" aria-label="Tautan ke bagian ${escapeHtml(cleanText)}">#</a>` +
        `</h${level}>`
      )
      i++
      continue
    }

    // 3. Blockquote: > text
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < len && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      const quoteContent = quoteLines.map(l => parseInline(l)).join('<br />')
      htmlParts.push(`<blockquote class="legal-quote"><p>${quoteContent}</p></blockquote>`)
      continue
    }

    // 4. Tables: | Header 1 | Header 2 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = []
      while (i < len && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }

      if (tableLines.length >= 2) {
        const headerCols = tableLines[0]
          .slice(1, -1)
          .split('|')
          .map(c => parseInline(c.trim()))
        
        let bodyStartIndex = 1
        // Jika baris ke-2 adalah separator |---|---|
        if (tableLines[1].replace(/[\s|:-]/g, '').length === 0) {
          bodyStartIndex = 2
        }

        let tableHtml = '<div class="legal-table-wrapper"><table class="legal-table"><thead><tr>'
        for (const h of headerCols) {
          tableHtml += `<th>${h}</th>`
        }
        tableHtml += '</tr></thead><tbody>'

        for (let r = bodyStartIndex; r < tableLines.length; r++) {
          const rowCols = tableLines[r]
            .slice(1, -1)
            .split('|')
            .map(c => parseInline(c.trim()))
          tableHtml += '<tr>'
          for (let c = 0; c < headerCols.length; c++) {
            tableHtml += `<td>${rowCols[c] || ''}</td>`
          }
          tableHtml += '</tr>'
        }
        tableHtml += '</tbody></table></div>'
        htmlParts.push(tableHtml)
        continue
      }
    }

    // 5. Unordered List: * Item atau - Item
    if (/^[\*\-]\s+/.test(trimmed)) {
      htmlParts.push('<ul class="legal-list legal-ul">')
      while (i < len && /^[\*\-]\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^[\*\-]\s+/, '')
        htmlParts.push(`<li>${parseInline(itemText)}</li>`)
        i++
      }
      htmlParts.push('</ul>')
      continue
    }

    // 6. Ordered List: 1. Item
    if (/^\d+\.\s+/.test(trimmed)) {
      htmlParts.push('<ol class="legal-list legal-ol">')
      while (i < len && /^\d+\.\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, '')
        htmlParts.push(`<li>${parseInline(itemText)}</li>`)
        i++
      }
      htmlParts.push('</ol>')
      continue
    }

    // 7. Standard Paragraph
    const pLines: string[] = []
    while (
      i < len &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !/^(?:---|\*\*\*|___)\s*$/.test(lines[i].trim()) &&
      !/^[\*\-]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|'))
    ) {
      pLines.push(lines[i].trim())
      i++
    }

    if (pLines.length > 0) {
      const fullText = pLines.join(' ')
      
      // Ambil excerpt awal untuk deskripsi SEO jika belum ada
      if (!excerpt && !fullText.startsWith('**Terakhir') && !fullText.startsWith('**Dasar')) {
        excerpt = fullText
          .replace(/\*\*|\*|`|_|\[.*?\]\(.*?\)/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 160)
      }

      htmlParts.push(`<p class="legal-p">${parseInline(fullText)}</p>`)
    }
  }

  return {
    html: htmlParts.join('\n'),
    toc,
    title: docTitle || 'Dokumen Resmi Platform',
    excerpt: excerpt || 'Dokumen resmi legalitas dan kepatuhan Program Kemitraan Kreator Asisten Guru.'
  }
}
