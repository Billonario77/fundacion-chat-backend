"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mensajesController_1 = require("../controllers/mensajesController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/enviar', mensajesController_1.enviarMensaje);
router.get('/no-leidos', mensajesController_1.getMensajesNoLeidos);
router.get('/turno/:turnoId', mensajesController_1.getMensajesPorTurno);
router.patch('/turno/:turnoId/leer', mensajesController_1.marcarComoLeidos);
exports.default = router;
//# sourceMappingURL=mensajesRoutes.js.map