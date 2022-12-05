// Move code def. to here bcs we mock dashboard in our test cases.
// If we import anything from `dashboard`, it would import what `Widgets.Screen` needs
// and it causes some errors
export enum DashboardCode {
  START_CODE = -777,
  EXIT_CODE = -999,
}
