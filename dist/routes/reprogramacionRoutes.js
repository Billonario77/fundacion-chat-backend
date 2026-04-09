"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reprogramacionController_1 = require("../controllers/reprogramacionController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/mis-reprogramaciones', reprogramacionController_1.getMisReprogramaciones);
router.get('/:reprogramacionId', reprogramacionController_1.getReprogramacionById);
router.patch('/:reprogramacionId/cancelar', reprogramacionController_1.cancelarReprogramacion);
router.post('/solicitar-cambio-guia', reprogramacionController_1.solicitarCambioGuia);
exports.default = router;
//# sourceMappingURL=reprogramacionRoutes.js.map