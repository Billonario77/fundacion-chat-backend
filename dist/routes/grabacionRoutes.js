"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const grabacionController_1 = require("../controllers/grabacionController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/iniciar', grabacionController_1.iniciarGrabacion);
router.post('/:turnoId/responder', grabacionController_1.responderGrabacion);
router.post('/:turnoId/finalizar', grabacionController_1.finalizarGrabacion);
exports.default = router;
//# sourceMappingURL=grabacionRoutes.js.map