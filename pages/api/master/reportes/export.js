import { verifyMasterRequest } from '../../../../lib/verifyMasterRequest';
import { fetchMasterReportPayload } from '../../../../lib/reportes/fetchReportData';
import {
  buildReportExcelWorkbook,
  getExportFilename,
  workbookToBuffer,
} from '../../../../lib/reportes/buildExcelWorkbook';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const auth = await verifyMasterRequest(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const periodoParam = String(req.query.periodo || '7d');

  try {
    const payload = await fetchMasterReportPayload(periodoParam);
    const workbook = buildReportExcelWorkbook(payload);
    const buffer = workbookToBuffer(workbook);
    const filename = getExportFilename();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('Error en /api/master/reportes/export:', err);
    return res.status(500).json({
      error: err.message || 'Error al exportar reportes',
    });
  }
}
