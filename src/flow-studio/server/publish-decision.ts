import { copy } from '../engine/copy';
import type { FlowStore } from '../data/repos';
import type { PublishRequest } from '../model/runtime';
import { ApiError, forbidden, notFound } from './errors';
import { isAuthorOf } from '../engine/publish';
import { can, personOf, type Actor } from './permissions';

/**
 * 01 §5.1, §6.1: approving or rejecting belongs to someone with the permission who did not make the change. The author
 * hears why first, even if they also lack the permission.
 */
export async function requestToDecide(store: FlowStore, actor: Actor, id: string): Promise<PublishRequest> {
  const request = await store.publishRequests.get(id);
  if (!request) {
    if (!can(actor, 'flow.approve_changes')) throw forbidden(copy.noApprovePermission);
    throw notFound('That request doesn’t exist.');
  }
  if (isAuthorOf(actor, { submittedBy: request.requestedBy, submittedById: request.requestedById })) throw forbidden(copy.cannotApproveOwn);
  if (!can(actor, 'flow.approve_changes')) throw forbidden(copy.noApprovePermission);
  // Decision 5: the permission says what they may do, the link says who is doing it. An account that is nobody approves nothing.
  if (personOf(actor) === null) throw forbidden(copy.notLinked);
  if (request.status !== 'pending') throw new ApiError(409, 'NOT_PENDING', copy.nothingWaiting);
  return request;
}
