import { useDispatch, useSelector } from 'react-redux';
import { Button } from 'react-bootstrap';
import { saveThreadThunk, unsaveThreadThunk } from '../../reducers/bookmarkSlice';

export default function SaveButton({ thread, size = 'sm' }) {
  const dispatch = useDispatch();
  const threadId = thread?._id;
  const isSaved = useSelector(
    (state) =>
      state.bookmarks?.savedThreads?.some((t) => t._id === threadId) ?? false
  );

  const handleToggle = (e) => {
    // Don't let the click bubble to a surrounding link/card.
    e.preventDefault();
    e.stopPropagation();
    if (isSaved) {
      dispatch(unsaveThreadThunk(threadId));
    } else {
      dispatch(saveThreadThunk(thread));
    }
  };

  return (
    <Button
      variant="light"
      size={size}
      onClick={handleToggle}
      aria-label={isSaved ? 'Unsave thread' : 'Save thread'}
      aria-pressed={isSaved}
      title={isSaved ? 'Saved' : 'Save'}
      className="save-btn"
    >
      <i className={`bi ${isSaved ? 'bi-bookmark-fill' : 'bi-bookmark'}`}></i>
    </Button>
  );
}
