"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const estadisticasController_1 = require("../controllers/estadisticasController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.use(auth_1.requireAdmin);
router.get('/', estadisticasController_1.getEstadisticas);
exports.default = router;
//# sourceMappingURL=estadisticasRoutes.js.map