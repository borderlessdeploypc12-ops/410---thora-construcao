"""Cria um PDF de teste com tabelas para testar extração"""
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from pathlib import Path

# Criar diretório test_pdfs se não existir
test_dir = Path("test_pdfs")
test_dir.mkdir(exist_ok=True)

# Criar PDF
pdf_path = test_dir / "exemplo.pdf"
doc = SimpleDocTemplate(str(pdf_path), pagesize=letter)

# Estilos
styles = getSampleStyleSheet()

# Conteúdo
story = []

# Título
title = Paragraph("ORÇAMENTO DE CONSTRUÇÃO", styles['Heading1'])
story.append(title)
story.append(Spacer(1, 12))

# Tabela de exemplo
data = [
    ['Código', 'Descrição', 'Unidade', 'Quantidade', 'Valor Unit.', 'Total'],
    ['001', 'Cimento 50kg', 'Saco', '100', '35.50', '3550.00'],
    ['002', 'Areia fina', 'm³', '50', '120.00', '6000.00'],
    ['003', 'Brita 0', 'm³', '30', '85.00', '2550.00'],
    ['004', 'Aço CA-50', 'Tonelada', '5', '4500.00', '22500.00'],
    ['005', 'Telha cerâmica', 'Mil', '12', '850.00', '10200.00'],
]

table = Table(data, colWidths=[100, 200, 100, 100, 100, 100])
table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 10),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
    ('GRID', (0, 0), (-1, -1), 1, colors.black)
]))

story.append(table)
story.append(Spacer(1, 20))

# Total
total_text = Paragraph("TOTAL: R$ 44.800,00", styles['Heading2'])
story.append(total_text)

# Criar PDF
doc.build(story)
print(f"✅ PDF criado: {pdf_path.absolute()}")
