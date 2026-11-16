import { useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { ApiError } from "../../services/api";
import { ProductImage } from "../../components/ProductImage";
import { Button, Card, Field, ErrorBanner } from "../../components/ui";
import { productService } from "../../services/product.service";
import {
  stocktakeService as api,
  StocktakeSession,
  IdentifiedCount,
  CountedItem,
} from "../../services/stocktake.service";
import { Product } from "../../types";
import { useToken } from "../../store/auth.store";
import { confirmAction } from "../../utils/dialog";
import { BarcodeCamera } from "./BarcodeCamera";

export function StocktakeSessionsScreen() {
  const token = useToken(),
    focused = useIsFocused(),
    navigation = useNavigation();
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [session, setSession] = useState<StocktakeSession>();
  const [sessions, setSessions] = useState<StocktakeSession[]>([]);
  const [page, setPage] = useState(1),
    [pages, setPages] = useState(1);
  const [identified, setIdentified] = useState<IdentifiedCount>();
  const [quantity, setQuantity] = useState(""),
    [reason, setReason] = useState("");
  const [search, setSearch] = useState(""),
    [results, setResults] = useState<Product[]>([]);
  const [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    epoch = useRef(0);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        epoch.current++;
        setIdentified(undefined);
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    const invalidate = () => {
      epoch.current++;
    };
    const unsubscribe = navigation.addListener("blur", () => {
      invalidate();
      setIdentified(undefined);
    });
    return () => {
      invalidate();
      unsubscribe();
    };
  }, [navigation]);
  async function list(next = page) {
    const response = await api.list(token, next);
    setSessions(response.items);
    setPage(next);
    setPages(response.totalPages);
  }
  useEffect(() => {
    void api
      .list(token)
      .then((r) => {
        setSessions(r.items);
        setPages(r.totalPages);
      })
      .catch((e) => setError(e.message));
  }, [token]);
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.details?.conflicts) {
        setConflicts(e.details.conflicts);
        setReview(true);
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function identify(body: { raw?: string; productId?: string }) {
    if (
      !session ||
      identified ||
      !focused ||
      AppState.currentState !== "active"
    )
      return;
    const current = epoch.current;
    await run(async () => {
      const value = await api.identify(token, session.id, body);
      if (current !== epoch.current) return;
      setIdentified(value);
      setQuantity(value.item ? String(value.item.countedQuantity) : "");
      setResults([]);
      setReview(false);
    });
  }
  async function reload() {
    if (session) setSession(await api.get(token, session.id));
  }
  async function finish(action: "complete" | "cancel") {
    if (!session) return;
    await run(async () => {
      if (
        !(await confirmAction(
          action === "complete" ? "Hoàn tất kiểm kê?" : "Hủy phiên?",
          action === "complete"
            ? `${session.countedCount} sản phẩm, ${session.adjustedCount} dòng lệch. Chỉ cập nhật phần đã đếm.`
            : "Không thay đổi tồn kho.",
        ))
      )
        return;
      try {
        await api.finish(token, session, action, reason);
      } finally {
        await reload();
      }
    });
  }
  const opened = session?.status === "IN_PROGRESS";
  return (
    <View style={{ gap: 12 }}>
      <ErrorBanner message={error} />
      {!session ? (
        <>
          <Button
            title="Bắt đầu phiên kiểm kê"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const created = await api.create(token);
                setSession(await api.get(token, created.id));
                setReason("");
              })
            }
          />
          <Button
            title="Tải lại danh sách"
            disabled={busy}
            onPress={() => void run(() => list())}
          />
          {sessions.map((s) => (
            <Card key={s.id}>
              <Text>
                {s.createdAt} · {s.status}
              </Text>
              <Button
                title="Mở phiên"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    setSession(await api.get(token, s.id));
                    setReason(s.reason ?? "");
                    setReview(false);
                  })
                }
              />
            </Card>
          ))}
          <Button
            title="Trang trước"
            disabled={busy || page <= 1}
            onPress={() => void run(() => list(page - 1))}
          />
          <Text>
            Trang {page}/{pages}
          </Text>
          <Button
            title="Trang sau"
            disabled={busy || page >= pages}
            onPress={() => void run(() => list(page + 1))}
          />
        </>
      ) : (
        <>
          <Text>
            {session.status} · {session.countedCount} đã đếm ·{" "}
            {session.adjustedCount} dòng lệch
          </Text>
          <Text>
            Chỉ số đã bấm lưu được giữ lại khi rời màn hình. Số chưa lưu có thể
            mất.
          </Text>
          <Button
            title="Danh sách phiên"
            disabled={busy}
            onPress={() => {
              epoch.current++;
              setSession(undefined);
              setIdentified(undefined);
              void run(() => list());
            }}
          />
          <Button
            title="Tải lại phiên / khôi phục sau mất mạng"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                setIdentified(undefined);
                await reload();
              })
            }
          />
          {opened && !review ? (
            <>
              <BarcodeCamera
                visible={!identified}
                active={!busy && !identified}
                onScan={(raw) => void identify({ raw })}
                hint="Quét nhận diện, sau đó nhập số thực đếm"
              />
              {!identified ? (
                <>
                  <Field
                    label="Tìm theo tên hoặc barcode"
                    value={search}
                    onChangeText={setSearch}
                  />
                  <Button
                    title="Tìm"
                    disabled={busy || !search.trim()}
                    onPress={() =>
                      void run(async () =>
                        setResults(
                          (
                            await productService.list(token, {
                              search,
                              limit: 20,
                            })
                          ).items,
                        ),
                      )
                    }
                  />
                  {results.map((p) => (
                    <Button
                      key={p.id}
                      title={`${p.name} · ${p.barcode}`}
                      disabled={busy}
                      onPress={() => void identify({ productId: p.id })}
                    />
                  ))}
                </>
              ) : (
                <Card>
                  <ProductImage
                    uri={identified.product.imageUrl}
                    name={identified.product.name}
                  />
                  <Text>
                    {identified.product.name} · {identified.product.barcode}
                  </Text>
                  <Text>
                    Tồn đối chiếu: {identified.baselineQuantity}{" "}
                    {identified.product.unit}
                  </Text>
                  <Field
                    label={`Số thực đếm (${identified.product.unit})`}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="number-pad"
                  />
                  <Button
                    title="Lưu kết quả"
                    disabled={
                      busy ||
                      !/^\d+$/.test(quantity) ||
                      !Number.isSafeInteger(Number(quantity))
                    }
                    onPress={() =>
                      void run(async () => {
                        try {
                          await api.save(
                            token,
                            session.id,
                            identified,
                            Number(quantity),
                          );
                          setIdentified(undefined);
                        } finally {
                          await reload();
                        }
                      })
                    }
                  />
                  <Button
                    title="Bỏ qua"
                    disabled={busy}
                    onPress={() => setIdentified(undefined)}
                  />
                </Card>
              )}
              <Button
                title="Xem lại để hoàn tất"
                disabled={busy || !!identified}
                onPress={() => setReview(true)}
              />
            </>
          ) : (
            <>
              {session.items.map((item: CountedItem) => (
                <Card key={item.productId}>
                  {conflicts.includes(item.productId) ? (
                    <Text accessibilityRole="alert">
                  Cần đếm lại hoặc bỏ dòng này
                    </Text>
                  ) : null}
                  <Text>
                    {item.productName} · {item.unit}
                  </Text>
                  <Text>
                    Tồn {item.baselineQuantity} → Đếm {item.countedQuantity} ·
                    Lệch {item.countedQuantity - item.baselineQuantity}
                  </Text>
                  {opened ? (
                    <>
                      <Button
                        title="Sửa / Đếm lại"
                        disabled={busy}
                        onPress={() =>
                          void identify({ productId: item.productId })
                        }
                      />
                      <Button
                        title="Bỏ dòng"
                        disabled={busy}
                        onPress={() =>
                          void run(async () => {
                            await api.remove(token, session.id, item);
                            await reload();
                          })
                        }
                      />
                    </>
                  ) : null}
                </Card>
              ))}
              {opened ? (
                <>
                  <Field
                    label="Lý do kiểm kê (bắt buộc)"
                    value={reason}
                    onChangeText={setReason}
                  />
                  <Button
                    title="Hoàn tất — cập nhật tồn phần đã đếm"
                    disabled={busy || !reason.trim() || !session.items.length}
                    onPress={() => void finish("complete")}
                  />
                  <Button
                    title="Tiếp tục đếm"
                    disabled={busy}
                    onPress={() => setReview(false)}
                  />
                  <Button
                    title="Hủy phiên"
                    disabled={busy}
                    onPress={() => void finish("cancel")}
                  />
                </>
              ) : null}
            </>
          )}
        </>
      )}
    </View>
  );
}
