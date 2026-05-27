import html2canvas from 'html2canvas'

export async function captureAndShare(element: HTMLElement, title: string): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    logging: false,
  })

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))), 'image/png')
  )

  const file = new File([blob], 'scorecard.png', { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title, text: title })
  } else {
    // Desktop fallback — download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'scorecard.png'
    a.click()
    URL.revokeObjectURL(url)
  }
}
