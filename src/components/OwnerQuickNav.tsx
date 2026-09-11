/**
 * Navegación rápida del owner.
 *
 * Desde que AppLayout gestiona la navegación (sidebar + barra inferior) este
 * componente no pinta nada. Se mantiene como no-op para no tocar los puntos
 * donde se monta (AdminView, Devices). El JSX antiguo se eliminó porque
 * referenciaba variables inexistentes y no compilaba en modo estricto.
 */
const OwnerQuickNav = () => null;

export default OwnerQuickNav;
