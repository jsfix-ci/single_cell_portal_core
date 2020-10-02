export default function checkMissingAuthToken() {
  // error handling for auth errors when getting user access tokens
  if (window.SCP.userAccessToken === '' && window.SCP.userSignedIn) {
    var errorTitle = 'Please sign in again';
    var errorText = '<p class="text-danger">There appears to be an issue with your session - ' +
      'please sign out and back in again to continue using Single Cell Portal. </p>';
    var signOutBtn = "<span class='pull-right'><a class='btn btn-primary' data-method='delete' href='/single_cell/users/sign_out'>" +
      "<span class='fas fa-sign-out-alt fa-fw'></span> Sign Out</a></span>";
    var errorMsg = errorText + signOutBtn;
    $('#generic-modal-spinner').html(errorMsg + "<p>&nbsp;</p>");
    $('#generic-modal-spinner').removeClass('spinner-target');
    $('#generic-modal-title').html(errorTitle);
    $('#generic-modal-title').removeClass('text-center');
    $('#generic-modal-footer').remove();
    $('#generic-modal').modal('show')
  }
}