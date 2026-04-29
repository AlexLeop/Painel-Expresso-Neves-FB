/**
 * Mapeamento do Padrão Open Delivery (v1.7.0) para Fleetbase JSON:API
 */

export const normalizeOpenDeliveryToFleetbase = (openDeliveryPayload: any) => {
    // Exemplo de mapeamento básico baseado na documentação Open Delivery Logistics Service
    // e Fleetbase FleetOps API
    
    // O Open Delivery envia dados estruturados de merchant, customer, items, etc.
    const merchant = openDeliveryPayload.merchant;
    const customer = openDeliveryPayload.customer;
    const destination = openDeliveryPayload.destination;
    
    return {
      data: {
        type: "order",
        attributes: {
          internal_id: openDeliveryPayload.orderId,
          type: "food_delivery", // Pode ser parametrizado
          status: "created",
          // Mapear payload do customer para o pickup/dropoff no Fleetbase
          payload: {
            pickup: {
              name: merchant?.name || "Lojista Desconhecido",
              phone: merchant?.phone,
              // O endereço do merchant precisa vir das configs do gateway ou do payload
              address: merchant?.address?.formattedAddress || "", 
            },
            dropoff: {
              name: customer?.name || "Cliente Final",
              phone: customer?.phone,
              address: destination?.address?.formattedAddress || "",
              location: {
                 type: "Point",
                 coordinates: [destination?.address?.coordinates?.longitude || 0, destination?.address?.coordinates?.latitude || 0]
              }
            },
            // Itens do pedido Open Delivery
            entities: (openDeliveryPayload.items || []).map((item: any) => ({
                name: item.name,
                description: item.options?.map((opt:any) => opt.name).join(', ') || "",
                quantity: item.quantity,
                price: item.price
            }))
          },
          meta: {
            source: "open_delivery",
            original_payload: openDeliveryPayload
          }
        }
      }
    };
  };
